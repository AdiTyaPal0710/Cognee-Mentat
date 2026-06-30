import { useState } from 'react';
import axios from 'axios';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';

export function Sidebar() {

    const [uploading, setUploading] = useState(false);
    const documents = useLiveQuery(() => db.documents.toArray());

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);

        // Add to Dexie cache immediately
        const docId = await db.documents.add({
            filename: file.name,
            status: 'processing',
            timestamp: Date.now()
        });

        const formData = new FormData();
        formData.append('file', file);

        try {

            //post request to ingest endpoint
            await axios.post('http://localhost:8000/ingest', formData);
            await db.documents.update(docId, { status: 'ingested' });
        } catch (error) {
            await db.documents.update(docId, { status: 'error' });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="w-64 bg-gray-100 p-4 border-r h-screen overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Workspace</h2>

            <label className="block bg-blue-500 text-white text-center py-2 rounded cursor-pointer mb-4">
                {uploading ? 'Processing...' : 'Upload PDF'}
                <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.tex,.md" />
            </label>

            <div>
                <h3 className="font-semibold text-sm mb-2">Ingested Data</h3>
                <ul>
                    {documents?.map(doc => (
                        <li key={doc.id} className="text-sm py-1 border-b">
                            {doc.filename} <span className="text-xs text-gray-500">[{doc.status}]</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}