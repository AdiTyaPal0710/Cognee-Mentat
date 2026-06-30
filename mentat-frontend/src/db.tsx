import Dexie, { Table } from "dexie";

export interface Document {

    id?: number;
    filename: string;
    status: 'uploading' | 'processing' | 'ingested' | 'error';
    timestamp: number;
}

export class MentatDatabase extends Dexie {
    documents!: Table<Document>;

    constructor() {
        super("MentatDB");
        this.version(1).stores({
            documents: '++id, filename, status',
        });
    }
}

export const db = new MentatDatabase();