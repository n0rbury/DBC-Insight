/**
 * Copyright (C) 2022 Landon Harris
 * Copyright (C) 2026 Jiaqi Chen (n0rbury)

 * This program is free software; you can redistribute it and/or 
 * modify it under the terms of the GNU General Public License as 
 * published by the Free Software Foundation; version 2.
 * 
 * This program is distributed in the hope that it will be useful, 
 * but WITHOUT ANY WARRANTY; without even the implied warranty of 
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the 
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License 
 * along with this program. If not, see 
 * <https://www.gnu.org/licenses/old-licenses/gpl-2.0-standalone.html>.
*/

import { readFileSync } from "fs";
import { join, basename } from "path";
import * as vscode from 'vscode'
import { LanguageClient } from "vscode-languageclient/node";
import { 
    Database,
} from "dbclib"


class DBCPanel implements vscode.CustomTextEditorProvider {
    private static readonly viewType = 'dbcLanguage.dbc';
    public panel: vscode.WebviewPanel | null;
    private _extensionPath: string;
    public client: LanguageClient | null;
    private _currentDocument: vscode.TextDocument | null;
    private _notificationListener: vscode.Disposable | null;

    public static register(context: vscode.ExtensionContext, client: LanguageClient): {a: vscode.Disposable, b: DBCPanel}{
		const provider = new DBCPanel(context);
        provider.client = client;
		const providerRegistration = vscode.window.registerCustomEditorProvider(DBCPanel.viewType, provider);
		return {a: providerRegistration, b: provider};
	}

    public constructor(private readonly context: vscode.ExtensionContext){
        this._extensionPath = context.asAbsolutePath(join('client', 'build'));
        this.panel = null;
        this.client = null;
        this._currentDocument = null;
        this._notificationListener = null;
    }

    // public getPanel(){
    //     return this.panel;
    // }

	private _getHtmlForWebview(webview: vscode.Webview) {
		const manifest = JSON.parse(readFileSync(join(this._extensionPath, 'asset-manifest.json'), {encoding: 'utf8'}));
		const mainScript:string = manifest['files']['main.js'];
		const mainStyle:string = manifest['files']['main.css'];

		const scriptUri = webview.asWebviewUri(vscode.Uri.file(join(this._extensionPath, mainScript)));
		const styleUri = webview.asWebviewUri(vscode.Uri.file(join(this._extensionPath, mainStyle)));

		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();
		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
				<meta name="theme-color" content="#000000">
				<title>DBC Insight</title>
				<link rel="stylesheet" type="text/css" href="${styleUri}">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}' 'unsafe-eval'; style-src ${webview.cspSource} 'unsafe-inline';">
				<base href="${webview.asWebviewUri(vscode.Uri.file(this._extensionPath))}/">
			</head>
			<body>
				<noscript>You need to enable JavaScript to run this app.</noscript>
				<div id="root"></div>
				
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}

    public parsedDBC(received: string){
        if(this.panel == null)
            return;
        this.panel.webview.postMessage(received);
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument, 
        webviewPanel: vscode.WebviewPanel, 
        _token: vscode.CancellationToken): 
        Promise<void>
    {
        // entrypoint
        
        webviewPanel.webview.options = {
            enableScripts: true,
			localResourceRoots: [
				vscode.Uri.file(this._extensionPath),
                vscode.Uri.file(join(this.context.extensionPath, 'client', 'build'))
			]
        };
        
        this.panel = webviewPanel;
        webviewPanel.webview.html = this._getHtmlForWebview(webviewPanel.webview);

        this._currentDocument = document;
        this.panel.title = `DBC Insight: ${basename(document.uri.fsPath)}`;

        this.registerCallbacks(webviewPanel);      
    }

    public update(document: vscode.TextDocument) {
        if (!this.panel) return;
        this._currentDocument = document;
        this.panel.title = `DBC Insight: ${basename(document.uri.fsPath)}`;
        this.client?.sendNotification("dbc/parseRequest", document.uri.toString());
    }

    private registerCallbacks(webviewPanel: vscode.WebviewPanel){
        // document change event
        this._notificationListener = this.client?.onNotification("dbc/fileParsed", (result: { uri: string, database: string }) => {
            if (this._currentDocument && result.uri === this._currentDocument.uri.toString()) {
                webviewPanel.webview.postMessage(result.database);
            }
        }) || null;
        
        this.client?.onNotification("dbc/closeFile", (uri: vscode.Uri) => {
            if(this._currentDocument && uri == this._currentDocument.uri){
                webviewPanel.dispose();
            }
        })

        if (this._currentDocument) {
            this.client?.sendNotification("dbc/parseRequest", this._currentDocument.uri.toString());
        }
        
        webviewPanel.onDidDispose(() => {
            if (this.panel === webviewPanel) {
                this.panel = null;
            }
            this._notificationListener?.dispose();
            this._notificationListener = null;
            this._currentDocument = null;
        });
    }
}

export default DBCPanel;

function getNonce() {
	let text = "";
	const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
