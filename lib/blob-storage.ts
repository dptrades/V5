import { put, list } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

// Helper to check if Vercel Blob token is configured
export const isBlobConfigured = (): boolean => {
    return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
};

/**
 * Saves data to Vercel Blob or falls back to local file system
 */
export async function saveToBlob(pathname: string, data: any): Promise<string | null> {
    const jsonString = JSON.stringify(data, null, 2);

    if (!isBlobConfigured()) {
        // Fallback to local file system
        try {
            const localPath = path.join(process.cwd(), pathname);
            const dir = path.dirname(localPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(localPath, jsonString, 'utf-8');
            console.log(`[Storage] Saved locally to ${pathname}`);
            return `file://${localPath}`;
        } catch (e) {
            console.error(`[Storage] Local write failed for ${pathname}:`, e);
            return null;
        }
    }

    // Vercel Blob write
    try {
        const result = await put(pathname, jsonString, {
            access: 'public',
            addRandomSuffix: false // keeps the file URL static and deterministic
        });
        console.log(`[Storage] Uploaded to Vercel Blob: ${pathname} -> ${result.url}`);
        return result.url;
    } catch (e) {
        console.error(`[Storage] Vercel Blob write failed for ${pathname}:`, e);
        return null;
    }
}

/**
 * Reads data from Vercel Blob or falls back to local file system
 */
export async function getFromBlob<T>(pathname: string, fallback: T): Promise<T> {
    if (!isBlobConfigured()) {
        // Fallback to local file system
        try {
            const localPath = path.join(process.cwd(), pathname);
            if (fs.existsSync(localPath)) {
                const content = fs.readFileSync(localPath, 'utf-8');
                return JSON.parse(content) as T;
            }
        } catch (e) {
            console.error(`[Storage] Local read failed for ${pathname}:`, e);
        }
        return fallback;
    }

    // Vercel Blob read
    try {
        const { blobs } = await list();
        // Match the pathname exactly
        const found = blobs.find(b => b.pathname === pathname);
        if (!found) {
            console.log(`[Storage] Pathname ${pathname} not found in Vercel Blob storage, returning fallback`);
            return fallback;
        }
        
        // Fetch raw JSON from public URL
        const res = await fetch(found.url);
        if (!res.ok) {
            throw new Error(`HTTP error ${res.status}`);
        }
        return await res.json() as T;
    } catch (e) {
        console.error(`[Storage] Vercel Blob read failed for ${pathname}, using local fallback:`, e);
        
        // Final fallback to local filesystem if network or blob API fails
        try {
            const localPath = path.join(process.cwd(), pathname);
            if (fs.existsSync(localPath)) {
                const content = fs.readFileSync(localPath, 'utf-8');
                return JSON.parse(content) as T;
            }
        } catch (localErr) {
            console.error(`[Storage] Local fallback read failed for ${pathname}:`, localErr);
        }
        return fallback;
    }
}
