/*
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
import React from "react";
import './App.css';

import loading from './loading.svg'
import { decodeDb, Database, Message, Node, Signal } from 'dbclib';
import { URI, Utils } from 'vscode-uri';

type SelectedItem = 
    | { type: 'node'; data: Node }
    | { type: 'message'; data: Message }
    | { type: 'signal'; data: Signal }
    | null;

type SortMode = 'dbc' | 'id-asc' | 'id-desc' | 'name-asc' | 'name-desc';

interface Props { }

interface State {
    db: Database;
    loading: boolean;
    errorState: number;
    searchValue: string;
    selectedItem: SelectedItem;
    expandedGroups: Set<string>;
    sortMode: SortMode;
    showSearchResults: boolean;
}

class App extends React.Component<Props, State> {
    timer: any;
    constructor(props: Props) {
        super(props);
        this.state = {
            db: new Database(),
            loading: true,
            errorState: 0,
            searchValue: "",
            selectedItem: null,
            expandedGroups: new Set(['nodes', 'messages']),
            sortMode: 'id-asc',
            showSearchResults: false
        };
        this.timer = null;
    }

    render() {
        try {
            if (this.state.loading) {
                return (
                    <div className="Loading">
                        <img src={loading} className="LoadingSVG" alt="loading" />
                        <h1 className="App-title">Loading DBC Insight</h1>
                    </div>
                )
            } else if (this.state.errorState === 1) {
                return (
                    <div className="Loading">
                        <h1 className="Error">DBC too large to parse (known bug)</h1>
                        <p>Encoded representation of parsed DBC is too large for VSCode message passing</p>
                    </div>
                )
            } else if (this.state.errorState === 2) {
                return (
                    <div className="Loading">
                        <h1 className="Error">Uh oh...Something strange is afoot</h1>
                        <p>It seems the parser gave up on sending your file to the display panel. Have you tried turning it off and back on?</p>
                        <p>(Just close this window and open it again with the inspect icon)</p>
                    </div>
                )
            }

            const { db, searchValue, showSearchResults } = this.state;
            const lowerSearch = searchValue.trim().toLowerCase();
            
            let results: { type: 'node' | 'message' | 'signal'; data: any; parent?: Message }[] = [];
            if (lowerSearch.length > 0) {
                const cleanSearch = lowerSearch.startsWith('0x') ? lowerSearch.substring(2) : lowerSearch;
                
                // Nodes
                if (db.nodes) {
                    Array.from(db.nodes.values()).forEach(node => {
                        if (node.name.toLowerCase().includes(lowerSearch)) results.push({ type: 'node', data: node });
                    });
                }
                // Messages
                if (db.messages) {
                    Array.from(db.messages.values()).forEach(msg => {
                        const idHex = msg.id.toString(16).toLowerCase();
                        const idDec = msg.id.toString();
                        if (msg.name.toLowerCase().includes(lowerSearch) || 
                            idDec.includes(lowerSearch) || 
                            idHex.includes(cleanSearch)) {
                            results.push({ type: 'message', data: msg });
                        }
                    });
                }
                // Signals
                if (db.messages) {
                    Array.from(db.messages.values()).forEach(msg => {
                        if (msg.signals) {
                            Array.from(msg.signals.values()).forEach(sig => {
                                if (sig.name.toLowerCase().includes(lowerSearch)) results.push({ type: 'signal', data: sig, parent: msg });
                            });
                        }
                    });
                }
            }

            return (
                <div className="App">
                    <div className="Sidebar">
                        <div className="searchContainer">
                            <div className="searchWrapper">
                                <input
                                    value={this.state.searchValue}
                                    onChange={e => this.setState({ searchValue: e.target.value, showSearchResults: true })}
                                    onFocus={() => this.setState({ showSearchResults: true })}
                                    placeholder="Search..."
                                    className="searchBox"
                                />
                                {showSearchResults && results.length > 0 && (
                                    <div className="searchMenu">
                                        {results.slice(0, 50).map((res, i) => (
                                            <div 
                                                key={i}
                                                className="searchMenuItem"
                                                onClick={() => this.jumpTo(res)}
                                            >
                                                <span className="itemType">{res.type}</span>
                                                <span className="itemName">
                                                    {res.type === 'message' ? `✉ ${res.data.name}` : res.type === 'node' ? `⬢ ${res.data.name}` : `≋ ${res.data.name}`}
                                                </span>
                                                {res.parent && <span className="itemContext">in {res.parent.name}</span>}
                                                {res.type === 'message' && <span className="itemContext">ID: 0x{res.data.id.toString(16).toUpperCase()} ({res.data.id})</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="sortContainer">
                                <span>Sort Messages by:</span>
                                <select 
                                    value={this.state.sortMode} 
                                    onChange={e => this.setState({ sortMode: e.target.value as SortMode })}
                                    className="sortSelect"
                                >
                                    <option value="id-asc">ID (Ascending)</option>
                                    <option value="id-desc">ID (Descending)</option>
                                    <option value="name-asc">Name (Ascending)</option>
                                    <option value="name-desc">Name (Descending)</option>
                                    <option value="dbc">DBC Order</option>
                                </select>
                            </div>
                        </div>
                        <div className="Sidebar-content" onClick={() => this.setState({ showSearchResults: false })}>
                            {this.renderTree()}
                        </div>
                    </div>
                    <div className="MainContent" onClick={() => this.setState({ showSearchResults: false })}>
                        {this.renderDetailView()}
                    </div>
                </div>
            );
        } catch (e) {
            console.error('Crash in App render:', e);
            return <div>Error rendering app: {String(e)}</div>;
        }
    }

    jumpTo(res: { type: 'node' | 'message' | 'signal'; data: any; parent?: Message }) {
        const expandedGroups = new Set(this.state.expandedGroups);
        if (res.type === 'node') {
            expandedGroups.add('nodes');
        } else if (res.type === 'message') {
            expandedGroups.add('messages');
        } else if (res.type === 'signal' && res.parent) {
            expandedGroups.add('messages');
            expandedGroups.add(`msg-${res.parent.id}`);
        }
        
        this.setState({ 
            selectedItem: { type: res.type, data: res.data },
            expandedGroups,
            showSearchResults: false,
            searchValue: ""
        });
    }

    renderTree() {
        const { db, searchValue, expandedGroups, sortMode } = this.state;
        const lowerSearch = searchValue.toLowerCase();

        const filteredNodes = Array.from(db.nodes.values()).filter(node => {
            return node.name.toLowerCase().includes(lowerSearch);
        });

        const sortMessages = (msgs: Message[]) => {
            const result = [...msgs];
            switch (sortMode) {
                case 'id-asc': return result.sort((a, b) => a.id - b.id);
                case 'id-desc': return result.sort((a, b) => b.id - a.id);
                case 'name-asc': return result.sort((a, b) => a.name.localeCompare(b.name));
                case 'name-desc': return result.sort((a, b) => b.name.localeCompare(a.name));
                case 'dbc': return result;
                default: return result;
            }
        };

        const filteredMessages = sortMessages(Array.from(db.messages.values()).filter(msg => {
            const matchesMsg = (
                msg.name.toLowerCase().includes(lowerSearch) || 
                msg.id.toString().includes(lowerSearch) ||
                msg.id.toString(16).includes(lowerSearch)
            );
            const matchesSig = (
                Array.from(msg.signals.values()).some(sig => sig.name.toLowerCase().includes(lowerSearch))
            );
            return matchesMsg || matchesSig;
        }));

        return (
            <div>
                <div className="TreeHeader" onClick={() => this.toggleGroup('nodes')}>
                    <span className={`Chevron ${expandedGroups.has('nodes') ? 'expanded' : ''}`}>▶</span>
                    Network Nodes ({filteredNodes.length})
                </div>
                {expandedGroups.has('nodes') && (
                    <div className="TreeGroup">
                        {filteredNodes.map(node => (
                            <div key={node.name}>
                                <div 
                                    className={`TreeItem ${this.state.selectedItem?.type === 'node' && this.state.selectedItem.data === node ? 'selected' : ''}`}
                                    onClick={() => { this.selectItem('node', node); this.toggleGroup(`node-${node.name}`); }}
                                >
                                    <span 
                                        className={`Chevron ${expandedGroups.has(`node-${node.name}`) ? 'expanded' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); this.toggleGroup(`node-${node.name}`); }}
                                    >▶</span>
                                    ⬢ {node.name}
                                </div>
                                {expandedGroups.has(`node-${node.name}`) ? (
                                    <div className="TreeGroup">
                                        <div className="TreeHeader" onClick={(e) => { e.stopPropagation(); this.toggleGroup(`node-${node.name}-tx`); }}>
                                            <span className={`Chevron ${expandedGroups.has(`node-${node.name}-tx`) ? 'expanded' : ''}`}>▶</span>
                                            TX Messages ({Array.from(db.messages.values()).filter(msg => msg.transmitter === node.name || msg.transmitters.includes(node.name)).length})
                                        </div>
                                        {expandedGroups.has(`node-${node.name}-tx`) && (
                                            <div className="TreeGroup">
                                                {sortMessages(Array.from(db.messages.values())
                                                    .filter(msg => msg.transmitter === node.name || msg.transmitters.includes(node.name)))
                                                    .map(msg => (
                                                        <div 
                                                            key={msg.id}
                                                            className={`TreeItem ${this.state.selectedItem?.type === 'message' && this.state.selectedItem.data === msg ? 'selected' : ''}`}
                                                            onClick={() => this.selectItem('message', msg)}
                                                        >
                                                            ✉ {msg.name}
                                                        </div>
                                                    ))}
                                            </div>
                                        )}

                                        <div className="TreeHeader" onClick={(e) => { e.stopPropagation(); this.toggleGroup(`node-${node.name}-rx`); }}>
                                            <span className={`Chevron ${expandedGroups.has(`node-${node.name}-rx`) ? 'expanded' : ''}`}>▶</span>
                                            RX Messages ({Array.from(db.messages.values()).filter(msg => Array.from(msg.signals.values()).some(sig => sig.receivers.includes(node.name))).length})
                                        </div>
                                        {expandedGroups.has(`node-${node.name}-rx`) && (
                                            <div className="TreeGroup">
                                                {sortMessages(Array.from(db.messages.values())
                                                    .filter(msg => Array.from(msg.signals.values()).some(sig => sig.receivers.includes(node.name))))
                                                    .map(msg => (
                                                        <div 
                                                            key={msg.id}
                                                            className={`TreeItem ${this.state.selectedItem?.type === 'message' && this.state.selectedItem.data === msg ? 'selected' : ''}`}
                                                            onClick={() => this.selectItem('message', msg)}
                                                        >
                                                            ✉ {msg.name}
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                )}

                <div className="TreeHeader" onClick={() => this.toggleGroup('messages')}>
                    <span className={`Chevron ${expandedGroups.has('messages') ? 'expanded' : ''}`}>▶</span>
                    Messages ({filteredMessages.length})
                </div>
                {expandedGroups.has('messages') && (
                    <div className="TreeGroup">
                        {filteredMessages.map(msg => (
                                <div key={msg.id}>
                                    <div 
                                        className={`TreeItem ${this.state.selectedItem?.type === 'message' && this.state.selectedItem.data === msg ? 'selected' : ''}`}
                                        onClick={() => { this.selectItem('message', msg); this.toggleGroup(`msg-${msg.id}`); }}
                                    >
                                        <span 
                                            className={`Chevron ${expandedGroups.has(`msg-${msg.id}`) ? 'expanded' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); this.toggleGroup(`msg-${msg.id}`); }}
                                        >▶</span>
                                        ✉ {msg.name} (0x{msg.id.toString(16).toUpperCase()})
                                    </div>
                                    {expandedGroups.has(`msg-${msg.id}`) ? (
                                        <div className="TreeGroup">
                                            {Array.from(msg.signals.values()).map(sig => (
                                                <div 
                                                    key={sig.name}
                                                    className={`TreeItem ${this.state.selectedItem?.type === 'signal' && this.state.selectedItem.data === sig ? 'selected' : ''}`}
                                                    onClick={() => this.selectItem('signal', sig)}
                                                >
                                                    ≋ {sig.name}
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    renderDetailView() {
        const { selectedItem } = this.state;
        if (!selectedItem) {
            return (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', opacity: 0.5 }}>
                    Select an item to view details
                </div>
            );
        }

        return (
            <div style={{ padding: '0 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h1>{selectedItem.data.name}</h1>
                    <span style={{ 
                        padding: '4px 8px', 
                        backgroundColor: 'var(--vscode-badge-background)', 
                        color: 'var(--vscode-badge-foreground)',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }}>
                        {selectedItem.type.toUpperCase()}
                    </span>
                </div>
                <hr style={{ borderColor: 'var(--vscode-contrastBorder)', opacity: 0.3 }} />
                
                {selectedItem.type === 'node' && this.renderNodeDetails(selectedItem.data)}
                {selectedItem.type === 'message' && this.renderMessageDetails(selectedItem.data)}
                {selectedItem.type === 'signal' && this.renderSignalDetails(selectedItem.data)}
            </div>
        );
    }

    renderNodeDetails(node: Node) {
        return (
            <div>
                <div className="PropertyGrid">
                    <div className="PropertyLabel">Name</div>
                    <div>{node.name}</div>
                    <div className="PropertyLabel">Comment</div>
                    <div>{node.comment || 'No comment'}</div>
                </div>
            </div>
        );
    }

    renderMessageDetails(msg: Message) {
        return (
            <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px' }}>
                    <div className="PropertyGrid">
                        <div className="PropertyLabel">ID</div>
                        <div>0x{msg.id.toString(16).toUpperCase()} ({msg.id})</div>
                        <div className="PropertyLabel">Size</div>
                        <div>{msg.size} bytes</div>
                        <div className="PropertyLabel">Transmitter</div>
                        <div>{msg.transmitter}</div>
                        <div className="PropertyLabel">Comment</div>
                        <div>{msg.comment || 'No comment'}</div>
                    </div>
                    <div style={{ minWidth: '350px' }}>
                        {this.renderBitMatrix(msg)}
                    </div>
                </div>
                <h3>Signals ({msg.signals.size})</h3>
                <table className="DetailTable">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Start Bit</th>
                            <th>Length</th>
                            <th>Order</th>
                            <th>Value Type</th>
                            <th>Unit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from(msg.signals.values()).map(sig => (
                            <tr 
                                key={sig.name} 
                                onClick={() => this.selectItem('signal', sig)}
                                style={{ cursor: 'pointer' }}
                            >
                                <td>{sig.name}</td>
                                <td>{sig.startBit}</td>
                                <td>{sig.bitSize}</td>
                                <td>{sig.byteOrder ? 'Intel' : 'Motorola'}</td>
                                <td>{sig.valueType ? 'Signed' : 'Unsigned'}</td>
                                <td>{sig.unit}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    renderSignalDetails(sig: Signal) {
        let descriptions: [any, any][] = [];
        
        // The parser stores descriptions directly in sig.valTable (not sig.valTable.descriptions)
        // or sometimes in a ValTable object.
        const tableData = (sig as any).valTable;
        
        if (tableData) {
            try {
                if (tableData instanceof Map || typeof tableData.set === 'function') {
                    descriptions = Array.from(tableData.entries());
                } else if (tableData.descriptions) {
                    const desc = tableData.descriptions;
                    descriptions = desc instanceof Map ? Array.from(desc.entries()) : Object.entries(desc);
                } else if (typeof tableData === 'object') {
                    descriptions = Object.entries(tableData);
                }
            } catch (e) {
                console.error('Error processing descriptions:', e);
            }
        }

        return (
            <div>
                <div className="PropertyGrid">
                    <div className="PropertyLabel">Name</div>
                    <div>{sig.name}</div>
                    <div className="PropertyLabel">Start Bit</div>
                    <div>{sig.startBit}</div>
                    <div className="PropertyLabel">Length</div>
                    <div>{sig.bitSize} bits</div>
                    <div className="PropertyLabel">Byte Order</div>
                    <div>{sig.byteOrder ? 'Little Endian (Intel)' : 'Big Endian (Motorola)'}</div>
                    <div className="PropertyLabel">Value Type</div>
                    <div>{sig.valueType ? 'Signed' : 'Unsigned'}</div>
                    <div className="PropertyLabel">Factor</div>
                    <div>{sig.factor}</div>
                    <div className="PropertyLabel">Offset</div>
                    <div>{sig.offset}</div>
                    <div className="PropertyLabel">Range</div>
                    <div>[{sig.minimum}, {sig.maximum}]</div>
                    <div className="PropertyLabel">Unit</div>
                    <div>{sig.unit || 'None'}</div>
                    <div className="PropertyLabel">Multiplex</div>
                    <div>{sig.multiplexIndicator || 'No'}</div>
                    <div className="PropertyLabel">Receivers</div>
                    <div>{sig.receivers.join(', ') || 'None'}</div>
                    <div className="PropertyLabel">Comment</div>
                    <div>{sig.comment || 'No comment'}</div>
                </div>

                {descriptions.length > 0 && (
                    <div style={{ marginTop: '20px' }}>
                        <h3>Value Descriptions</h3>
                        <table className="DetailTable">
                            <thead>
                                <tr>
                                    <th>Value</th>
                                    <th>Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {descriptions.map(([val, desc]) => (
                                    <tr key={val}>
                                        <td>{val}</td>
                                        <td>{desc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    }

    getSignalBits(sig: Signal): number[] {
        const bits: number[] = [];
        if (sig.byteOrder) { // Little Endian (Intel)
            for (let i = 0; i < sig.bitSize; i++) {
                bits.push(sig.startBit + i);
            }
        } else { // Big Endian (Motorola)
            let currentBit = sig.startBit;
            for (let i = 0; i < sig.bitSize; i++) {
                bits.push(currentBit);
                let bitInByte = currentBit % 8;
                let byteAddr = Math.floor(currentBit / 8);
                if (bitInByte === 0) {
                    currentBit = (byteAddr + 1) * 8 + 7;
                } else {
                    currentBit--;
                }
            }
        }
        return bits;
    }

    renderBitMatrix(msg: Message) {
        const matrixSize = Math.max(8, msg.size);
        const signalColors = [
            '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6',
            '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3'
        ];

        // Map bit index to signal
        const bitMap = new Map<number, { sig: Signal; color: string }>();
        Array.from(msg.signals.values()).forEach((sig, idx) => {
            const color = signalColors[idx % signalColors.length];
            this.getSignalBits(sig).forEach(bit => {
                bitMap.set(bit, { sig, color });
            });
        });

        return (
            <div style={{ marginTop: '20px', userSelect: 'none' }}>
                <h4>Bit Matrix</h4>
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(9, 1fr)', 
                    gap: '1px', 
                    width: 'fit-content',
                    backgroundColor: 'var(--vscode-contrastBorder)',
                    border: '1px solid var(--vscode-contrastBorder)'
                }}>
                    <div style={{ backgroundColor: 'var(--vscode-editor-background)' }} /> 
                    {[7, 6, 5, 4, 3, 2, 1, 0].map(b => (
                        <div key={b} style={{ 
                            textAlign: 'center', 
                            fontSize: '10px', 
                            padding: '4px',
                            backgroundColor: 'var(--vscode-editor-background)'
                        }}>{b}</div>
                    ))}
                    
                    {Array.from({ length: matrixSize }).map((_, byteIdx) => (
                        <React.Fragment key={byteIdx}>
                            <div style={{ 
                                fontSize: '10px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                padding: '0 4px',
                                backgroundColor: 'var(--vscode-editor-background)'
                            }}>Byte {byteIdx}</div>
                            {Array.from({ length: 8 }).map((_, bitInByteIdx) => {
                                const bitIdx = byteIdx * 8 + (7 - bitInByteIdx);
                                const bitInfo = bitMap.get(bitIdx);
                                const isStartBit = bitInfo?.sig.startBit === bitIdx;
                                
                                return (
                                    <div 
                                        key={bitInByteIdx}
                                        style={{ 
                                            width: '30px', 
                                            height: '30px', 
                                            backgroundColor: bitInfo ? bitInfo.color : 'var(--vscode-editor-background)',
                                            color: bitInfo ? '#000' : 'inherit',
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            fontSize: '9px',
                                            cursor: bitInfo ? 'pointer' : 'default',
                                            fontWeight: isStartBit ? 'bold' : 'normal',
                                            border: isStartBit ? '2px solid #fff' : 'none',
                                            boxSizing: 'border-box'
                                        }}
                                        title={bitInfo ? `${bitInfo.sig.name} (Bit ${bitIdx})${bitInfo.sig.multiplexIndicator ? ` [Mux: ${bitInfo.sig.multiplexIndicator}]` : ''}` : `Bit ${bitIdx}`}
                                        onClick={() => bitInfo && this.selectItem('signal', bitInfo.sig)}
                                    >
                                        {bitIdx}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
                <div style={{ marginTop: '10px', fontSize: '12px' }}>
                    <span style={{ fontWeight: 'bold', border: '1px solid #fff', padding: '0 4px' }}>Bold</span> border indicates Start Bit.
                </div>
            </div>
        );
    }

    toggleGroup(group: string) {
        const expandedGroups = new Set(this.state.expandedGroups);
        if (expandedGroups.has(group)) {
            expandedGroups.delete(group);
        } else {
            expandedGroups.add(group);
        }
        this.setState({ expandedGroups });
    }

    selectItem(type: 'node' | 'message' | 'signal', data: any) {
        this.setState({ selectedItem: { type, data } });
    }

    componentDidMount() {
        window.addEventListener(
            "message",
            (ev: MessageEvent) => {
                clearTimeout(this.timer);
                if (ev.data === "OVERLOADED STRING") {
                    this.setState({
                        errorState: 1,
                        loading: false,
                    })
                } else {
                    let db = decodeDb(ev.data);
                    console.log("decoded here", db);
                    this.setState({
                        db: db,
                        loading: false,
                        errorState: 0,
                    });
                }
            }
        );
        this.timer = setTimeout(() => {
            this.setState({ errorState: 2, loading: false });
        }, 5000);
    }
}

export default App;
