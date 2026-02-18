import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import fs from 'fs/promises';
import path from 'path';
import { env } from "./env";

const SECRET_KEY = env.JWT_SECRET || "";
const key = new TextEncoder().encode(SECRET_KEY);

export const SESSION_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours

export async function encrypt(payload: any) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("4h")
        .sign(key);
}

export async function decrypt(input: string): Promise<any> {
    const { payload } = await jwtVerify(input, key, {
        algorithms: ["HS256"],
    });
    return payload;
}

export async function login(user: { name: string; email: string }) {
    // Create the session
    const expires = new Date(Date.now() + SESSION_EXPIRY_MS);
    const session = await encrypt({ user, expires });

    // Save the session in a cookie
    (await cookies()).set("session", session, { expires, httpOnly: true, secure: true, sameSite: 'lax' });
}

export async function logout() {
    // Destroy the session
    (await cookies()).set("session", "", { expires: new Date(0) });
}

export async function getSession() {
    const session = (await cookies()).get("session")?.value;
    if (!session) return null;
    try {
        return await decrypt(session);
    } catch (error) {
        return null;
    }
}

export const SIGNUP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Creates a signed token containing user info.
 * This carries user data from the "Info" step to the "Verify" step statelessly.
 */
export async function createSignupToken(data: { email: string; name: string }) {
    return await new SignJWT(data)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("10m")
        .sign(key);
}

/**
 * Verifies a signup token and returns its payload if valid.
 */
export async function verifySignupToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, key, {
            algorithms: ["HS256"],
        });
        return payload as { email: string; name: string };
    } catch (error) {
        return null;
    }
}

/**
 * Parses the users CSV file.
 */
export async function getUsersFromCSV() {
    try {
        const dataDir = path.join(process.cwd(), 'data');
        const filePath = path.join(dataDir, 'users.csv');

        // 1. Try local filesystem first (works on local dev)
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return parseCSV(content);
        } catch (e: any) {
            // 2. Fallback to GitHub on Vercel or if local file is missing
            if (process.env.VERCEL || e.code === 'ENOENT') {
                console.log('[Auth] Local CSV missing or Vercel env, attempting GitHub fallback...');
                const githubContent = await fetchFromGitHub();
                if (githubContent) return parseCSV(githubContent);
            }
            return [];
        }
    } catch (error) {
        console.error('General failure in getUsersFromCSV:', error);
        return [];
    }
}

function parseCSV(content: string) {
    const lines = content.trim().split('\n');
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
        const values = line.split(',');
        const user: any = {};
        headers.forEach((header, i) => {
            const key = header.trim().toLowerCase();
            user[key] = values[i];
        });
        return user;
    });
}

async function fetchFromGitHub() {
    try {
        const token = process.env.GITHUB_TOKEN;
        const owner = process.env.GITHUB_REPO_OWNER || process.env.VERCEL_GIT_REPO_OWNER;
        const repo = process.env.GITHUB_REPO_NAME || process.env.VERCEL_GIT_REPO_SLUG;
        const path = 'user/users.csv';

        if (!token || !owner || !repo) return null;

        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json'
            },
            cache: 'no-store'
        });

        if (res.ok) {
            const data = await res.json();
            return Buffer.from(data.content, 'base64').toString('utf-8');
        }
    } catch (e) {
        console.error('[Auth] GitHub fetch failed:', e);
    }
    return null;
}

/**
 * Background task to sync the local CSV to GitHub.
 * This ensures data persistence on Vercel.
 */
async function syncToGitHub(csvContent: string) {
    try {
        const token = process.env.GITHUB_TOKEN;
        const owner = process.env.GITHUB_REPO_OWNER || process.env.VERCEL_GIT_REPO_OWNER;
        const repo = process.env.GITHUB_REPO_NAME || process.env.VERCEL_GIT_REPO_SLUG;
        const path = 'user/users.csv';

        if (!token || !owner || !repo) {
            console.warn('[Sync] GitHub sync skipped: Missing credentials (GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME)');
            return;
        }

        // 1. Get the current file SHA (required for updating)
        let sha: string | undefined;
        try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github.v3+json'
                }
            });
            if (res.ok) {
                const data = await res.json();
                sha = data.sha;
            }
        } catch (e) {
            console.log('[Sync] File does not exist yet or error fetching SHA');
        }

        // 2. Push to GitHub
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update user data: ${new Date().toISOString()}`,
                content: Buffer.from(csvContent).toString('base64'),
                sha: sha // Include if file exists
            })
        });

        if (res.ok) {
            console.log('[Sync] Successfully pushed users.csv to GitHub');
        } else {
            const error = await res.json();
            console.error('[Sync] GitHub push failed:', error);
        }
    } catch (error) {
        console.error('[Sync] General failure in syncToGitHub:', error);
    }
}

/**
 * Persists user data to a flat CSV file and syncs to GitHub in background.
 */
export async function saveUser(user: { name: string; email: string }) {
    try {
        const timestamp = new Date().toISOString();
        const users = await getUsersFromCSV();

        // Update or add user
        const index = users.findIndex((u: any) => u.email === user.email);
        const userData = { ...user, lastLogin: timestamp };

        if (index >= 0) {
            users[index] = { ...users[index], ...userData };
        } else {
            users.push(userData);
        }

        // Convert back to CSV
        const headers = ['Name', 'Email', 'LastLogin'];
        const csvContent = [
            headers.join(','),
            ...users.map(u => [u.name, u.email, u.lastlogin || u.lastLogin].join(','))
        ].join('\n');

        // 1. Always attempt GitHub sync (primary storage on Vercel)
        syncToGitHub(csvContent).catch(err => {
            console.error('[Sync] Background sync failed:', err);
        });

        // 2. Only write to local filesystem if NOT on Vercel
        if (!process.env.VERCEL) {
            try {
                const dataDir = path.join(process.cwd(), 'data');
                const filePath = path.join(dataDir, 'users.csv');
                await fs.mkdir(dataDir, { recursive: true });
                await fs.writeFile(filePath, csvContent);
                console.log(`[Auth] User ${user.email} saved to local CSV`);
            } catch (fsError) {
                console.warn('[Auth] Local FS write skipped or failed:', fsError);
            }
        } else {
            console.log(`[Auth] User ${user.email} skipping local FS write on Vercel`);
        }

        return true;
    } catch (error) {
        console.error('General failure in saveUser:', error);
        return false;
    }
}
