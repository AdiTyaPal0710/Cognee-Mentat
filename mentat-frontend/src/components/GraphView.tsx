// src/components/GraphView.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, { Background, Controls, Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';

// Cache positions so nodes don't jump on every poll
const positionCache: Record<string, { x: number; y: number }> = {};

export function GraphView() {
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);

    const fetchGraph = useCallback(async () => {
        try {
            // call /graph endpoint
            const response = await axios.get('http://localhost:8000/graph');
            const rawNodes = response.data.nodes || [];
            const rawEdges = response.data.edges || [];

            // Map nodes to React Flow format
            const rfNodes = rawNodes.map((n: any, index: number) => {
                const nodeId = n.id || String(index);
                if (!positionCache[nodeId]) {
                    positionCache[nodeId] = { x: Math.random() * 800, y: Math.random() * 600 };
                }
                return {
                    id: nodeId,
                    position: positionCache[nodeId],
                    data: { label: n.name || n.id || 'Node' },
                };
            });

            // Map Cognee/Kuzu edges
            const rfEdges = rawEdges.map((e: any, index: number) => ({
                id: `e-${index}`,
                source: e.source,
                target: e.target,
                label: e.type || '',
            }));

            setNodes(rfNodes);
            setEdges(rfEdges);
        } catch (error) {
            console.error("Failed to load graph topology", error);
        }
    }, []);

    // Poll the graph every 5 seconds to catch new nodes after ingestion
    useEffect(() => {
        fetchGraph();
        const interval = setInterval(fetchGraph, 5000);
        return () => clearInterval(interval);
    }, [fetchGraph]);

    return (
        <div style={{ height: '100%', width: '100%' }}>
            <ReactFlow nodes={nodes} edges={edges} fitView>
                <Background />
                <Controls />
            </ReactFlow>
        </div>
    );
}