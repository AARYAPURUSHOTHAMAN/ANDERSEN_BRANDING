import React, { useState, useCallback, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import {
    Upload,
    FileSpreadsheet,
    CheckCircle,
    XCircle,
    Loader2,
    Search,
    Download,
    BarChart2,
    Mail,
    Building2,
    User,
    AlertCircle,
    Copy,
    LogOut,
    Lock,
    ArrowRight,
    ShieldCheck,
    Zap,
    Sun,
    Moon,
    Layers,
    MousePointer2,
    Linkedin,
    ExternalLink,
    ArrowLeftRight,
    History as HistoryIcon,
    Clock,
    PieChart as PieChartIcon,
    Info,
    X,
    Settings,
    Webhook,
    RotateCw
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ProspectRow, MappingConfig, HistoryEntry, ScrapedSpeaker } from './types';
import { findEmail, verifyEmail } from './services/getProspect';
import { suggestMappings, findLinkedInUrl } from './services/geminiService';
import { scrapeEvent } from './services/scraperService';
import { Globe, Users } from 'lucide-react';

// Initialize Supabase client with safety fallbacks to prevent "supabaseUrl is required" error
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://jftnwoojuofxzufmrogx.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdG53b29qdW9meHp1Zm1yb2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MzE3NDAsImV4cCI6MjA4NDUwNzc0MH0.NI_ZasN_JiVAg_4uKiwm4HKUgdZ9qVKwYSjcVySaJLs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true, // Changed to true to match default, but making explicit
        autoRefreshToken: true,
    }
});

/**
 * Utility for Tailwind class merging
 */
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * BackgroundBoxes Component implementation
 */
const BoxesCore = ({ className, ...rest }: { className?: string }) => {
    const rows = new Array(30).fill(1);
    const cols = new Array(30).fill(1);
    const colors = [
        "#7dd3fc", "#f9a8d4", "#86efac", "#fde047", "#fca5a5", "#d8b4fe", "#93c5fd", "#a5b4fc", "#c4b5fd",
    ];
    // Corrected: Replaced System.random() with Math.random()
    const getRandomColor = () => colors[Math.floor(Math.random() * colors.length)];

    return (
        <div
            style={{
                transform: `translate(-45%,-60%) skewX(-48deg) skewY(14deg) scale(1.5) rotate(0deg) translateZ(0)`,
            }}
            className={cn(
                "absolute left-1/4 p-4 -top-1/4 flex -translate-x-1/2 -translate-y-1/2 w-full h-full z-[-10] pointer-events-none",
                className
            )}
            {...rest}
        >
            {rows.map((_, i) => (
                <div key={`row` + i} className="w-24 h-16 border-l border-slate-700/30 relative">
                    {cols.map((_, j) => (
                        <motion.div
                            key={`col` + j}
                            whileHover={{
                                backgroundColor: getRandomColor(),
                                transition: { duration: 0 },
                            }}
                            animate={{
                                backgroundColor: "rgba(0,0,0,0)",
                                transition: { duration: 2 },
                            }}
                            className="w-24 h-16 border-r border-t border-slate-700/30 relative"
                        >
                            {j % 2 === 0 && i % 2 === 0 ? (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth="1.5"
                                    stroke="currentColor"
                                    className="absolute h-6 w-10 -top-[14px] -left-[22px] text-slate-700 stroke-[1px] pointer-events-none"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                            ) : null}
                        </motion.div>
                    ))}
                </div>
            ))}
        </div>
    );
};

const BackgroundBoxes = React.memo(BoxesCore);

const App: React.FC = () => {
    // Theme State
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');

    // Supabase Auth Session
    const [session, setSession] = useState<any>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(false);
    const [isInitialAuthCheck, setIsInitialAuthCheck] = useState(true);
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
    const [authEmail, setAuthEmail] = useState('');
    const [authPass, setAuthPass] = useState('');
    const [authName, setAuthName] = useState('');
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [showApiResultModal, setShowApiResultModal] = useState(false);
    const [apiResponseData, setApiResponseData] = useState<any>(null);
    const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
    const [isHistoryView, setIsHistoryView] = useState(false);

    // App Mode & Input Mode
    const [appMode, setAppMode] = useState<'enrich' | 'verify' | 'linkedin' | 'event-scraper'>('enrich');
    const [inputMode, setInputMode] = useState<'bulk' | 'single'>('bulk');

    // Local History State
    const [history, setHistory] = useState<{
        enrich: HistoryEntry[];
        verify: HistoryEntry[];
        linkedin: HistoryEntry[];
        'event-scraper': HistoryEntry[];
    }>({ enrich: [], verify: [], linkedin: [], 'event-scraper': [] });

    // App Logic State
    const [file, setFile] = useState<File | null>(null);

    // Debugging Render State
    useEffect(() => {
        console.log("App Render State - session:", session ? "Present" : "Null", "isInitialAuthCheck:", isInitialAuthCheck);
    }, [session, isInitialAuthCheck]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [rows, setRows] = useState<ProspectRow[]>([]);
    const [mapping, setMapping] = useState<MappingConfig | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Cross-feature persistence
    const [resultsFromFinder, setResultsFromFinder] = useState<ProspectRow[]>([]);

    // Single Entry State
    const [singleName, setSingleName] = useState('');
    const [singleCompany, setSingleCompany] = useState('');
    const [singleEmail, setSingleEmail] = useState('');
    const [singleResult, setSingleResult] = useState<{ email?: string; linkedinUrl?: string; status?: string; message?: string; rawData?: any; metadata?: any; cachedAt?: string; cachedType?: string } | null>(null);

    // Event Scraper State
    const [eventUrl, setEventUrl] = useState('');
    const [scrapedSpeakers, setScrapedSpeakers] = useState<ScrapedSpeaker[]>([]);
    const [lastScrapedResults, setLastScrapedResults] = useState<ScrapedSpeaker[]>([]);
    const [isScraping, setIsScraping] = useState(false);

    // Listen for auth state changes
    useEffect(() => {
        // Check initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log("Initial auth check:", session ? "Session restored" : "No session found");
            setSession(session);
            setIsInitialAuthCheck(false);
        }).catch(err => {
            console.error("Failed to get initial session:", err);
            setIsInitialAuthCheck(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            console.log(`Auth state changed: ${_event}`, session ? "Session active" : "No session");
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Fetch history from Supabase
    const fetchHistory = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('history')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) throw error;

            if (data) {
                // Fetch uniquely synced history IDs to ensure robust persistence
                const { data: syncRecords } = await supabase
                    .from('api_sync_results')
                    .select('history_id')
                    .eq('user_id', userId);

                const syncedIds = new Set(syncRecords?.map(r => r.history_id) || []);

                const newHistory = {
                    enrich: [] as HistoryEntry[],
                    verify: [] as HistoryEntry[],
                    linkedin: [] as HistoryEntry[],
                    'event-scraper': [] as HistoryEntry[]
                };

                data.forEach((row: any) => {
                    const entry: HistoryEntry = {
                        id: row.id,
                        type: row.type,
                        feature: row.feature,
                        input: row.input,
                        result: row.result,
                        status: row.status,
                        timestamp: row.timestamp || new Date(row.created_at).getTime(),
                        data: row.data,
                        headers: row.headers,
                        mapping: row.mapping,
                        hasCached: row.data?.[0]?.hasCached,
                        cachedAt: row.data?.[0]?.cachedAt,
                        // Cross-reference with api_sync_results table for truth
                        synced: syncedIds.has(row.id) || (Array.isArray(row.data) ? row.data[0]?.synced : row.data?.synced),
                        cachedType: Array.isArray(row.data) ? row.data[0]?.cachedType : row.data?.cachedType
                    };

                    if (row.data?.[0]?.synced) {
                        console.log(`Found synced entry in history: ${row.id}`, row.data[0]);
                    }

                    // Primary categorization based on stored 'feature' column
                    if (row.feature === 'verify') {
                        newHistory.verify.push(entry);
                    } else if (row.feature === 'linkedin') {
                        newHistory.linkedin.push(entry);
                    } else if (row.feature === 'enrich') {
                        newHistory.enrich.push(entry);
                    } else {
                        // Fallback heuristics for older data
                        if (row.type === 'bulk') {
                            const hasLinkedin = row.data?.[0]?.linkedinUrl;
                            const hasEmail = row.data?.[0]?.email;
                            if (hasLinkedin) newHistory.linkedin.push(entry);
                            else if (hasEmail) newHistory.enrich.push(entry);
                            else newHistory.enrich.push(entry);
                        } else {
                            if (row.input.includes('@') && !row.input.includes(' ')) newHistory.verify.push(entry);
                            else if (row.result && row.result.includes('linkedin.com')) newHistory.linkedin.push(entry);
                            else newHistory.enrich.push(entry);
                        }
                    }
                });

                setHistory(newHistory);
            }
        } catch (err) {
            console.error("Error fetching history:", err);
        }
    };

    useEffect(() => {
        if (session?.user?.id) {
            fetchHistory(session.user.id);
        } else {
            setHistory({ enrich: [], verify: [], linkedin: [], 'event-scraper': [] });
        }
    }, [session]);

    const formatHistoryInput = (entry: HistoryEntry) => {
        if (entry.type === 'bulk') return entry.input;

        // For single: "Name @ Company" -> show full Name, hide @ Company
        if (entry.input.includes(' @ ')) {
            return entry.input.split(' @ ')[0].trim();
        }

        // For email masking (Verify)
        if (entry.input.includes('@') && !entry.input.includes(' ')) {
            const parts = entry.input.split('@');
            const local = parts[0];
            const domain = parts[1];
            if (local.length > 3) {
                return `${local.substring(0, 2)}***@${domain}`;
            }
        }

        return entry.input;
    };

    const formatHistoryResult = (result: string) => {
        if (!result || typeof result !== 'string') return result;
        // Mask emails
        if (result.includes('@') && !result.includes(' ')) {
            const parts = result.split('@');
            const local = parts[0];
            const domain = parts[1];
            if (local.length > 2) {
                return `${local.substring(0, 2)}**@${domain}`;
            }
        }
        // Mask LinkedIn URLs loosely if needed, or just keep as is if user only asked for emails
        return result;
    };

    const saveToSupabase = async (entry: HistoryEntry, mode: string) => {
        if (!session?.user?.id) return;

        try {
            // 1. Prepare minimal data for history table, preserving cache info
            const minimalData = [{
                user_id: session.user.id,
                hasCached: entry.hasCached,
                cachedAt: entry.cachedAt,
                cachedType: entry.cachedType,
                synced: entry.synced
            }];

            // 2. Insert into 'history' table with feature
            const { data: historyData, error: historyError } = await supabase.from('history').insert({
                user_id: session.user.id,
                type: entry.type,
                feature: mode, // Saving the feature type
                input: entry.input,
                result: entry.result,
                status: entry.status,
                timestamp: entry.timestamp,
                data: minimalData,
                headers: entry.headers,
                mapping: entry.mapping
            }).select().single();

            if (historyError) throw historyError;

            // 3. Insert into specific results table based on mode
            if (historyData && entry.data && entry.data.length > 0) {
                if (mode === 'enrich') {
                    const prospectRows = entry.data.map(item => ({
                        history_id: historyData.id,
                        user_id: session.user.id,
                        name: item.name ?? item.originalData?.[entry.mapping?.nameHeader || ''] ?? null,
                        company: item.company ?? item.originalData?.[entry.mapping?.companyHeader || ''] ?? null,
                        email: item.email,
                        status: item.status,
                        cached_at: item.cachedAt,
                        cached_type: item.cachedType,
                        synced: item.synced || (item.metadata?.synced)
                    }));
                    const { error } = await supabase.from('prospect_results').insert(prospectRows);
                    if (error) console.error("Failed to save prospect results", error);

                } else if (mode === 'verify') {
                    const verifyRows = entry.data
                        .filter(item => !!item.email)
                        .map(item => ({
                            history_id: historyData.id,
                            user_id: session.user.id,
                            email: item.email!,
                            status: item.status,
                            result: {
                                ...(item.metadata || item),
                                cached: !!item.cachedAt,
                                cachedAt: item.cachedAt,
                                cachedType: item.cachedType,
                                synced: item.synced || item.metadata?.synced
                            }
                        }));

                    if (verifyRows.length > 0) {
                        const { error } = await supabase.from('verification_results').insert(verifyRows);
                        if (error) console.error("Failed to save verification results", error);
                    }

                } else if (mode === 'linkedin') {
                    const linkedinRows = entry.data.map(item => ({
                        history_id: historyData.id,
                        user_id: session.user.id,
                        name: item.name || item.originalData?.[entry.mapping?.nameHeader || ''] || undefined,
                        company: item.company || item.originalData?.[entry.mapping?.companyHeader || ''] || undefined,
                        linkedin_url: item.linkedinUrl,
                        status: item.status,
                        cached_at: item.cachedAt,
                        cached_type: item.cachedType,
                        synced: item.synced || (item.metadata?.synced)
                    }));
                    const { error } = await supabase.from('linkedin_results').insert(linkedinRows);
                    if (error) console.error("Failed to save linkedin results", error);
                }
                setCurrentHistoryId(historyData.id);
                return historyData.id;
            }
            return null;
        } catch (err) {
            console.error("Failed to save history to Supabase", err);
        }
    };


    // Global Status Color Mapper
    const getStatusColor = (status: string) => {
        const s = status.toLowerCase();
        const colorMap: Record<string, string> = {
            deliverable: '#10B981',
            valid: '#10B981',
            completed: '#10B981',
            success: '#10B981',
            found: '#3B82F6',
            undeliverable: '#EF4444',
            invalid: '#EF4444',
            failed: '#EF4444',
            risky: '#F59E0B',
            warning: '#F59E0B',
            pending: '#8B5CF6',
            processing: '#8B5CF6',
            searching: '#8B5CF6',
            unknown: '#64748B'
        };
        return colorMap[s] || '#8B5CF6';
    };

    const stats = useMemo(() => {
        if (appMode === 'enrich' || appMode === 'linkedin') {
            const completed = rows.filter(r => r.status === 'completed' || r.status === 'found').length;
            const notFound = rows.filter(r => r.status === 'not_found').length;
            const failed = rows.filter(r => r.status === 'failed').length;
            const pending = rows.filter(r => r.status === 'pending' || r.status === 'processing' || r.status === 'searching').length;

            return [
                { name: appMode === 'linkedin' ? 'Found' : 'Email Found', value: completed, color: appMode === 'linkedin' ? '#3B82F6' : '#10B981' },
                { name: 'Not Found', value: notFound, color: '#F59E0B' },
                { name: 'Failed', value: failed, color: '#EF4444' },
                { name: 'Pending', value: pending, color: '#8B5CF6' }
            ].filter(item => item.value > 0);
        } else {
            const counts: Record<string, number> = {};
            rows.forEach(r => {
                const s = r.status.toLowerCase();
                counts[s] = (counts[s] || 0) + 1;
            });

            const labelMap: Record<string, string> = {
                deliverable: 'Valid',
                undeliverable: 'Invalid',
                risky: 'Risky',
                unknown: 'Unknown',
                failed: 'Failed',
                pending: 'Pending',
                processing: 'Processing'
            };

            return Object.entries(counts)
                .filter(([_, value]) => value > 0)
                .map(([statusKey, value]) => ({
                    name: labelMap[statusKey] || statusKey.charAt(0).toUpperCase() + statusKey.slice(1),
                    value,
                    color: getStatusColor(statusKey)
                }));
        }
    }, [rows, appMode]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAuthLoading(true);
        setError(null);

        try {
            if (authMode === 'login') {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: authEmail,
                    password: authPass,
                });
                if (error) throw error;

                // Update profile on login
                if (data.user) {
                    await supabase.from('profiles').upsert({
                        id: data.user.id,
                        email: authEmail,
                        updated_at: new Date().toISOString()
                    });
                }

            } else {
                const { data, error } = await supabase.auth.signUp({
                    email: authEmail,
                    password: authPass,
                    options: {
                        data: {
                            full_name: authName,
                        },
                    },
                });
                if (error) throw error;

                // Create profile on signup
                if (data.user) {
                    await supabase.from('profiles').upsert({
                        id: data.user.id,
                        email: authEmail,
                        full_name: authName,
                        updated_at: new Date().toISOString()
                    });
                }
            }
        } catch (err: any) {
            setError(err.message || "Auth failed");
        } finally {
            setIsAuthLoading(false);
        }
    };

    const performLogout = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setShowLogoutConfirm(false);
        setFile(null);
        setRows([]);
        setHeaders([]);
        setMapping(null);
        setIsHistoryView(false);
        setAuthEmail('');
        setAuthPass('');
        setAuthName('');
        setSingleResult(null);
        setResultsFromFinder([]);
        setHistory({ enrich: [], verify: [], linkedin: [], 'event-scraper': [] }); // Clear history on logout
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;

        setFile(uploadedFile);
        setError(null);
        setIsHistoryView(false);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

                if (jsonData.length === 0) {
                    setError("The uploaded file appears to be empty.");
                    return;
                }

                const fileHeaders = Object.keys(jsonData[0]);
                setHeaders(fileHeaders);

                setIsSuggesting(true);
                const suggested = await suggestMappings(fileHeaders);

                // Helper to find exact case-sensitive header from suggested header
                const getLiteralHeader = (suggested: string, headers: string[]) => {
                    if (!suggested) return '';
                    return headers.find(h => h.toLowerCase() === suggested.toLowerCase()) || suggested;
                };

                // Correctly handle initial email mapping to prevent column mismatch
                const detectedEmailHeader = fileHeaders.find(h => h.toLowerCase().includes('email')) || '';

                // In verify mode, we don't want to default name/company to the email column if they aren't clearly found
                const initialMapping: MappingConfig = {
                    nameHeader: (appMode === 'verify' && suggested.nameHeader === detectedEmailHeader) ? '' : getLiteralHeader(suggested.nameHeader, fileHeaders),
                    companyHeader: (appMode === 'verify' && suggested.companyHeader === detectedEmailHeader) ? '' : getLiteralHeader(suggested.companyHeader, fileHeaders),
                    emailHeader: detectedEmailHeader
                };
                setMapping(initialMapping);
                setIsSuggesting(false);

                const initialRows: ProspectRow[] = jsonData.map((item, index) => ({
                    id: index.toString(),
                    name: initialMapping.nameHeader ? String(item[initialMapping.nameHeader] || '').trim() : '',
                    company: initialMapping.companyHeader ? String(item[initialMapping.companyHeader] || '').trim() : '',
                    email: initialMapping.emailHeader ? String(item[initialMapping.emailHeader] || '').trim() : undefined,
                    status: 'pending',
                    originalData: item
                }));
                setRows(initialRows);
            } catch (err) {
                setError("Error parsing file. Ensure it's a valid XLSX/CSV.");
            }
        };
        reader.readAsArrayBuffer(uploadedFile);
    };

    const startProcessing = async () => {
        if (!mapping) return;
        setIsProcessing(true);
        setIsHistoryView(false);

        let currentRowsState: ProspectRow[] = rows.map(row => ({
            ...row,
            name: mapping.nameHeader ? String(row.originalData[mapping.nameHeader] || '').trim() : '',
            company: mapping.companyHeader ? String(row.originalData[mapping.companyHeader] || '').trim() : '',
            email: (appMode === 'enrich' && !mapping.emailHeader) ? undefined : (mapping.emailHeader ? String(row.originalData[mapping.emailHeader] || '').trim() : row.email),
            status: 'pending' as const
        }));

        setRows(currentRowsState);

        for (let i = 0; i < currentRowsState.length; i++) {
            setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: appMode === 'linkedin' ? 'searching' : 'processing' } : r));

            const row = currentRowsState[i];
            if (!row.name && !row.company && !row.email && appMode !== 'verify') {
                currentRowsState = currentRowsState.map((r, idx) => idx === i ? { ...r, status: 'failed', error: 'Missing data' } : r);
                setRows([...currentRowsState]);
                continue;
            }

            let resultRowUpdate: Partial<ProspectRow> = {};

            // 1. Check Cache first
            const existing = await checkExistingResult(appMode, (appMode === 'verify' ? row.email : row.name) || '', row.company);

            if (existing) {
                if (appMode === 'enrich') {
                    resultRowUpdate = {
                        email: existing.email,
                        status: existing.status as any,
                        metadata: { ...existing.result, cached: true, synced: (existing as any).globallySynced },
                        synced: (existing as any).globallySynced,
                        cachedAt: existing.created_at,
                        cachedType: (existing as any).historyType
                    };
                } else if (appMode === 'linkedin') {
                    resultRowUpdate = {
                        linkedinUrl: existing.linkedin_url,
                        status: existing.status as any,
                        metadata: { cached: true, synced: (existing as any).globallySynced },
                        synced: (existing as any).globallySynced,
                        cachedAt: existing.created_at,
                        cachedType: (existing as any).historyType
                    };
                } else if (appMode === 'verify') {
                    resultRowUpdate = {
                        status: existing.status as any,
                        metadata: { ...existing.rawData, cached: true, synced: (existing as any).globallySynced },
                        synced: (existing as any).globallySynced,
                        cachedAt: existing.created_at,
                        cachedType: (existing as any).historyType
                    };
                }
            } else {
                // 2. Perform API Action if not in cache
                if (appMode === 'enrich') {
                    const result = await findEmail(row.name, row.company);
                    resultRowUpdate = {
                        email: result.email,
                        status: (result.success ? 'completed' : (result.message === 'No email found' ? 'not_found' : 'failed')) as any,
                        error: result.success ? undefined : result.message
                    };
                } else if (appMode === 'linkedin') {
                    const result = await findLinkedInUrl(row.name, row.company);
                    resultRowUpdate = {
                        linkedinUrl: result.url,
                        status: (result.success ? 'found' : 'not_found') as any,
                        error: result.success ? undefined : result.message
                    };
                } else if (appMode === 'verify') {
                    const emailToVerify = row.email;
                    if (!emailToVerify) {
                        resultRowUpdate = { status: 'failed', error: 'No email found' };
                    } else {
                        const result = await verifyEmail(emailToVerify);
                        resultRowUpdate = {
                            status: (result.success ? (result.status as any) : 'failed') as any,
                            error: result.success ? undefined : result.message,
                            metadata: result.rawData
                        };
                    }
                }
            }

            currentRowsState = currentRowsState.map((r, idx) => idx === i ? { ...r, ...resultRowUpdate } : r);
            setRows([...currentRowsState]);

            await new Promise(res => setTimeout(res, 300));
        }

        if (appMode === 'enrich') {
            setResultsFromFinder([...currentRowsState]);
        }

        const bulkEntry: HistoryEntry = {
            id: `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'bulk',
            input: file?.name || 'Bulk Session',
            result: `${currentRowsState.length} Records processed`,
            status: 'completed',
            timestamp: Date.now(),
            data: [...currentRowsState],
            headers: [...headers],
            mapping: mapping ? { ...mapping } : undefined,
            hasCached: currentRowsState.some(r => r.metadata?.cached),
            cachedAt: currentRowsState.find(r => r.cachedAt)?.cachedAt
        };

        // Save to Supabase
        const supabaseId = await saveToSupabase(bulkEntry, appMode);

        if (supabaseId) {
            bulkEntry.id = supabaseId;
        }
        setCurrentHistoryId(bulkEntry.id);

        // Modified to prevent duplicates based on same input and very close timestamp
        setHistory(prev => {
            const existingHistory = prev[appMode];
            const isDuplicate = existingHistory.some(e =>
                e.type === 'bulk' &&
                e.input === bulkEntry.input &&
                Math.abs(e.timestamp - bulkEntry.timestamp) < 2000
            );
            if (isDuplicate) return prev;
            return {
                ...prev,
                [appMode]: [bulkEntry, ...existingHistory].slice(0, 100)
            };
        });

        setIsProcessing(false);
    };

    const handleRetryFailed = async () => {
        if (!mapping || isProcessing) return;
        setIsProcessing(true);

        const failedIndices = rows
            .map((r, idx) => ({ status: r.status, idx }))
            .filter(({ status }) => status === 'failed' || status === 'undeliverable' || status === 'not_found')
            .map(({ idx }) => idx);

        if (failedIndices.length === 0) {
            setIsProcessing(false);
            return;
        }

        const updatedRows = [...rows];

        for (const i of failedIndices) {
            updatedRows[i] = { ...updatedRows[i], status: appMode === 'linkedin' ? 'searching' : 'processing' };
            setRows([...updatedRows]);

            const row = updatedRows[i];
            let resultRowUpdate: Partial<ProspectRow> = {};

            try {
                if (appMode === 'enrich') {
                    const result = await findEmail(row.name, row.company);
                    resultRowUpdate = {
                        email: result.email,
                        status: (result.success ? 'completed' : (result.message === 'No email found' ? 'not_found' : 'failed')) as any,
                        error: result.success ? undefined : result.message
                    };
                } else if (appMode === 'linkedin') {
                    const result = await findLinkedInUrl(row.name, row.company);
                    resultRowUpdate = {
                        linkedinUrl: result.url,
                        status: (result.success ? 'found' : 'not_found') as any,
                        error: result.success ? undefined : result.message
                    };
                } else if (appMode === 'verify') {
                    const emailToVerify = row.email;
                    if (!emailToVerify) {
                        resultRowUpdate = { status: 'failed', error: 'No email found' };
                    } else {
                        const result = await verifyEmail(emailToVerify);
                        resultRowUpdate = {
                            status: (result.success ? (result.status as any) : 'failed') as any,
                            error: result.success ? undefined : result.message,
                            metadata: result.rawData
                        };
                    }
                }
            } catch (err) {
                resultRowUpdate = { status: 'failed', error: 'Retry failed' };
            }

            updatedRows[i] = { ...updatedRows[i], ...resultRowUpdate };
            setRows([...updatedRows]);
            await new Promise(res => setTimeout(res, 300));
        }

        // Save updated results to Supabase (creating a new history record for the retry session)
        const bulkEntry: HistoryEntry = {
            id: `bulk-retry-${Date.now()}`,
            type: 'bulk',
            input: `Retry: ${file?.name || 'Bulk Session'}`,
            result: `${failedIndices.length} Failed records retried`,
            status: 'completed',
            timestamp: Date.now(),
            data: [...updatedRows],
            headers: [...headers],
            mapping: mapping ? { ...mapping } : undefined
        };

        const supabaseId = await saveToSupabase(bulkEntry, appMode);
        if (supabaseId) bulkEntry.id = supabaseId;
        setCurrentHistoryId(bulkEntry.id);

        setHistory(prev => ({
            ...prev,
            [appMode]: [bulkEntry, ...prev[appMode]].slice(0, 100)
        }));

        setIsProcessing(false);
    };

    const handleSingleRetry = async () => {
        if (!singleName && !singleCompany && !singleEmail) return;
        setIsProcessing(true);
        setSingleResult(null);
        setError(null);

        let resultPayload: any;
        try {
            if (appMode === 'enrich') {
                resultPayload = await findEmail(singleName, singleCompany);
                setSingleResult({
                    email: resultPayload.email,
                    status: resultPayload.success ? 'completed' : 'failed',
                    message: resultPayload.message,
                    metadata: { retry: true }
                });
            } else if (appMode === 'linkedin') {
                resultPayload = await findLinkedInUrl(singleName, singleCompany);
                setSingleResult({
                    linkedinUrl: resultPayload.url,
                    status: resultPayload.success ? 'found' : 'failed',
                    message: resultPayload.message,
                    metadata: { retry: true }
                });
            } else if (appMode === 'verify') {
                resultPayload = await verifyEmail(singleEmail);
                setSingleResult({
                    status: resultPayload.success ? resultPayload.status : 'failed',
                    message: resultPayload.message,
                    rawData: resultPayload.rawData,
                    metadata: { retry: true }
                });
            }

            const newHistoryEntry: HistoryEntry = {
                id: `single-retry-${Date.now()}`,
                type: 'single',
                input: `Retry: ${appMode === 'verify' ? singleEmail : `${singleName} @ ${singleCompany}`}`,
                result: resultPayload.email || resultPayload.url || resultPayload.status || 'Failed',
                status: resultPayload.status || (resultPayload.success ? (appMode === 'linkedin' ? 'found' : 'completed') : 'failed'),
                timestamp: Date.now(),
                data: [{
                    id: `retry-row-${Date.now()}`,
                    name: singleName,
                    company: singleCompany,
                    email: appMode === 'enrich' ? resultPayload.email : (appMode === 'verify' ? singleEmail : undefined),
                    linkedinUrl: appMode === 'linkedin' ? resultPayload.url : undefined,
                    status: resultPayload.status || (resultPayload.success ? 'completed' : 'failed'),
                    originalData: {},
                    metadata: { ...resultPayload.rawData, retry: true }
                }]
            };

            const supabaseId = await saveToSupabase(newHistoryEntry, appMode);
            if (supabaseId) newHistoryEntry.id = supabaseId;
            setCurrentHistoryId(newHistoryEntry.id);

            setHistory(prev => ({
                ...prev,
                [appMode]: [newHistoryEntry, ...prev[appMode]].slice(0, 100)
            }));
        } catch (err) {
            setError("Retry failed due to an unexpected error.");
        } finally {
            setIsProcessing(false);
        }
    };

    const checkExistingResult = async (mode: string, input1: string, input2?: string) => {
        if (!session?.user?.id) return null;

        try {
            let query: any;
            if (mode === 'enrich') {
                query = supabase.from('prospect_results')
                    .select('*')
                    .ilike('name', input1.trim())
                    .ilike('company', input2?.trim() || '')
                    .order('created_at', { ascending: true }) // Order by oldest first
                    .limit(50);

                console.log(`Checking cache for: ${input1}, ${input2}`, { mode });
            } else if (mode === 'verify') {
                query = supabase.from('verification_results')
                    .select('*')
                    .ilike('email', input1.trim())
                    .order('created_at', { ascending: true })
                    .limit(50);
            } else if (mode === 'linkedin') {
                query = supabase.from('linkedin_results')
                    .select('*')
                    .ilike('name', input1.trim())
                    .ilike('company', input2?.trim() || '')
                    .order('created_at', { ascending: true })
                    .limit(50);
            }

            if (!query) return null;
            const { data, error } = await query;
            if (error) throw error;

            const results = data || [];
            // Success statuses that should be prioritized for preserving initial search source
            const successStatuses = ['completed', 'found', 'deliverable', 'valid', 'risky', 'unknown', 'undeliverable', 'not_found'];

            // Find the oldest successful result (ASC order means the first one is oldest)
            let result = results.find(r => successStatuses.includes(r.status));

            // Fallback to the latest record if no preferred results found
            if (!result && results.length > 0) {
                result = results[results.length - 1];
            }

            if (result && result.history_id) {
                const { data: hData } = await supabase.from('history').select('type, data').eq('id', result.history_id).single();
                if (hData) {
                    const cachedTypeFromData = Array.isArray(hData.data) ? hData.data[0]?.cachedType : hData.data?.cachedType;
                    (result as any).historyType = cachedTypeFromData || hData.type;
                }
            }

            // --- Global Sync Check ---
            // If we found a result, check if it was ever synced to the API endpoint by ANY user
            if (result) {
                let syncQuery = supabase.from('api_sync_results').select('id').limit(1);
                if (mode === 'enrich' || mode === 'linkedin') {
                    syncQuery = syncQuery
                        .ilike('prospect_name', input1.trim())
                        .ilike('prospect_company', input2?.trim() || '');
                } else if (mode === 'verify') {
                    syncQuery = syncQuery.ilike('email_used', input1.trim());
                }

                const { data: syncData } = await syncQuery;
                if (syncData && syncData.length > 0) {
                    (result as any).globallySynced = true;
                }
            }
            // -------------------------

            return result || null;
        } catch (err) {
            console.error("Cache lookup failed", err);
            return null;
        }
    };

    const handleSingleAction = async () => {
        setIsProcessing(true);
        setSingleResult(null);
        setError(null);
        setIsHistoryView(false);

        let resultPayload: any;
        try {
            // 1. Check for existing local results (Cache)
            const existing = await checkExistingResult(appMode, appMode === 'verify' ? singleEmail : singleName, singleCompany);

            if (existing) {
                setSingleResult({
                    email: existing.email,
                    linkedinUrl: existing.linkedin_url,
                    status: existing.status,
                    message: "Already Processed",
                    rawData: existing.result,
                    metadata: { cached: true, synced: (existing as any).globallySynced },
                    cachedAt: existing.created_at,
                    cachedType: (existing as any).historyType
                });

                const cachedHistoryEntry: HistoryEntry = {
                    id: `single-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    type: 'single',
                    input: appMode === 'verify' ? singleEmail : `${singleName} @ ${singleCompany}`,
                    result: existing.email || existing.linkedin_url || existing.status || 'Success',
                    status: existing.status || 'completed',
                    timestamp: Date.now(),
                    data: [{
                        id: `single-row-${Date.now()}`,
                        name: singleName,
                        company: singleCompany,
                        email: existing.email,
                        linkedinUrl: existing.linkedin_url,
                        status: existing.status,
                        originalData: {},
                        synced: (existing as any).globallySynced,
                        metadata: { ...existing.result, cached: true, synced: (existing as any).globallySynced } // Ensure metadata includes cached and synced status
                    }],
                    hasCached: true,
                    synced: (existing as any).globallySynced,
                    cachedAt: existing.created_at,
                    cachedType: (existing as any).historyType
                };

                const supabaseId = await saveToSupabase(cachedHistoryEntry, appMode);
                if (supabaseId) cachedHistoryEntry.id = supabaseId;
                setCurrentHistoryId(cachedHistoryEntry.id);

                setHistory(prev => {
                    const existingHistory = prev[appMode];
                    return { ...prev, [appMode]: [cachedHistoryEntry, ...existingHistory].slice(0, 100) };
                });

                setIsProcessing(false);
                return;
            }

            // 2. Perform API Action if not found in cache
            if (appMode === 'enrich') {
                if (!singleName || !singleCompany) {
                    setError("Name and Company/Domain are required.");
                    setIsProcessing(false);
                    return;
                }
                resultPayload = await findEmail(singleName, singleCompany);
                setSingleResult({
                    email: resultPayload.email,
                    status: resultPayload.success ? 'completed' : 'failed',
                    message: resultPayload.message
                });
            } else if (appMode === 'linkedin') {
                if (!singleName || !singleCompany) {
                    setError("Name and Company/Domain are required.");
                    setIsProcessing(false);
                    return;
                }
                resultPayload = await findLinkedInUrl(singleName, singleCompany);
                setSingleResult({
                    linkedinUrl: resultPayload.url,
                    status: resultPayload.success ? 'found' : 'failed',
                    message: resultPayload.message
                });
            } else {
                if (!singleEmail) {
                    setError("Email is required.");
                    setIsProcessing(false);
                    return;
                }
                resultPayload = await verifyEmail(singleEmail);
                setSingleResult({
                    status: resultPayload.success ? resultPayload.status : 'failed',
                    message: resultPayload.message,
                    rawData: resultPayload.rawData
                });
            }

            const newHistoryEntry: HistoryEntry = {
                id: `single-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: 'single',
                input: appMode === 'verify' ? singleEmail : `${singleName} @ ${singleCompany}`,
                result: resultPayload.email || resultPayload.url || resultPayload.status || 'Failed',
                status: resultPayload.status || (resultPayload.success ? (appMode === 'linkedin' ? 'found' : 'completed') : 'failed'),
                timestamp: Date.now(),
                data: [{
                    id: `single-row-${Date.now()}`,
                    name: singleName,
                    company: singleCompany,
                    email: appMode === 'enrich' ? resultPayload.email : (appMode === 'verify' ? singleEmail : undefined),
                    linkedinUrl: appMode === 'linkedin' ? resultPayload.url : undefined,
                    status: resultPayload.status || (resultPayload.success ? 'completed' : 'failed'),
                    originalData: {},
                    metadata: resultPayload.rawData
                }]
            };

            // Save to Supabase
            const supabaseId = await saveToSupabase(newHistoryEntry, appMode);

            if (supabaseId) {
                newHistoryEntry.id = supabaseId;
            }
            setCurrentHistoryId(newHistoryEntry.id);

            setHistory(prev => {
                const existingHistory = prev[appMode];
                const isDuplicate = existingHistory.some(e =>
                    e.type === 'single' &&
                    e.input === newHistoryEntry.input &&
                    Math.abs(e.timestamp - newHistoryEntry.timestamp) < 2000
                );
                if (isDuplicate) return prev;
                return { ...prev, [appMode]: [newHistoryEntry, ...existingHistory].slice(0, 100) };
            });

        } catch (err) {
            setError("An unexpected error occurred.");
        } finally {
            setIsProcessing(false);
        }
    };

    const loadHistorySession = async (entry: HistoryEntry) => {
        setCurrentHistoryId(entry.id);
        setIsHistoryView(true);
        // Check for minimal data (stub with user_id)
        const dataAny = entry.data as any[];
        const isMinimal = dataAny && dataAny.length > 0 && !dataAny[0].name && dataAny[0].user_id;

        if (entry.type === 'bulk') {
            if (isMinimal) {
                setError(null);
                setIsProcessing(true);

                let tableName = 'prospect_results';
                if (entry.feature === 'verify') tableName = 'verification_results';
                if (entry.feature === 'linkedin') tableName = 'linkedin_results';

                const { data: results, error } = await supabase
                    .from(tableName)
                    .select('*')
                    .eq('history_id', entry.id);

                setIsProcessing(false);

                if (error || !results) {
                    console.error("Failed to load details", error);
                    setError("Failed to load history details.");
                    return;
                }

                let reconstructedRows: ProspectRow[] = [];

                if (entry.feature === 'verify') {
                    reconstructedRows = results.map((r: any) => {
                        const original = r.result || {};
                        return {
                            id: r.id,
                            name: original.name || '',
                            company: original.company || '',
                            email: r.email,
                            status: r.status as any,
                            originalData: original,
                            metadata: { ...original, cached: !!original.cached },
                            cachedAt: original.cachedAt,
                            cachedType: original.cachedType,
                            synced: original.synced
                        };
                    });
                } else if (entry.feature === 'linkedin') {
                    reconstructedRows = results.map((r: any) => ({
                        id: r.id,
                        name: r.name || '',
                        company: r.company || '',
                        linkedinUrl: r.linkedin_url,
                        status: r.status as any,
                        originalData: { ...r },
                        metadata: { ...r, cached: !!r.cached_at },
                        cachedAt: r.cached_at,
                        cachedType: r.cached_type,
                        synced: r.synced
                    }));
                } else {
                    reconstructedRows = results.map((p: any) => ({
                        id: p.id,
                        name: p.name || '',
                        company: p.company || '',
                        email: p.email,
                        status: p.status as any,
                        originalData: { ...p },
                        metadata: { ...p, cached: !!p.cached_at },
                        cachedAt: p.cached_at,
                        cachedType: p.cached_type,
                        synced: p.synced
                    }));
                }

                setRows(reconstructedRows);
                if (entry.headers) setHeaders(entry.headers);
                else setHeaders(['Name', 'Company', 'Email', 'Status']);

                setMapping(entry.mapping ? { ...entry.mapping } : null);
                setFile(new File([], entry.input));
                setInputMode('bulk');

            } else if (entry.data) {
                setRows([...entry.data]);
                setHeaders([...(entry.headers || [])]);
                setMapping(entry.mapping ? { ...entry.mapping } : null);
                setFile(new File([], entry.input));
                setInputMode('bulk');
            }
        } else if (entry.type === 'single') {
            setInputMode('single');
            if (appMode === 'verify') {
                setSingleEmail(entry.input);
            } else {
                const parts = entry.input.split(' @ ');
                setSingleName(parts[0] || '');
                setSingleCompany(parts[1] || '');
            }

            if (isMinimal) {
                let tableName = 'prospect_results';
                if (entry.feature === 'verify') tableName = 'verification_results';
                if (entry.feature === 'linkedin') tableName = 'linkedin_results';

                const { data: record } = await supabase.from(tableName).select('*').eq('history_id', entry.id).single();

                if (record) {
                    const mockResult: any = {
                        status: record.status,
                        message: "Already Processed", // Add message for cached single result
                        rawData: { cached: true } // Add cached metadata
                    };

                    if (entry.feature === 'verify') {
                        mockResult.email = record.email;
                        if (record.result) {
                            mockResult.message = record.result.message;
                            mockResult.rawData = { ...record.result, cached: true };
                        }
                    } else if (entry.feature === 'linkedin') {
                        mockResult.linkedinUrl = record.linkedin_url;
                    } else {
                        // Default / Enrich
                        mockResult.email = record.email;
                    }

                    setSingleResult(mockResult);
                }
            } else {
                const mockResult: any = { status: entry.status, message: "Already Processed" }; // Add message for cached single result
                if (appMode === 'enrich') mockResult.email = entry.result;
                else if (appMode === 'linkedin') mockResult.linkedinUrl = entry.result;
                setSingleResult(mockResult);
            }
        }
    };

    const downloadResults = () => {
        const dataToExport = rows.map(r => ({
            ...r.originalData,
            'Prospect Name': r.name,
            'Prospect Company': r.company,
            'Enriched Email': r.email || 'N/A',
            'LinkedIn URL': r.linkedinUrl || 'N/A',
            'Status': r.status
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Results");
        XLSX.writeFile(wb, "10xmailmatch_results.xlsx");
        setShowExportModal(false);
    };

    const downloadResultsJSON = () => {
        const dataToExport = rows.map(r => ({
            ...r.originalData,
            'Prospect Name': r.name,
            'Prospect Company': r.company,
            'Enriched Email': r.email || 'N/A',
            'LinkedIn URL': r.linkedinUrl || 'N/A',
            'Status': r.status
        }));
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '10xmailmatch_results.json';
        a.click();
        URL.revokeObjectURL(url);
        setShowExportModal(false);
    };

    const processApiData = (data: any) => {
        if (!data) return data;
        const processItem = (item: any) => {
            if (typeof item !== 'object' || item === null) return item;
            const newItem = { ...item };

            // Attempt to find the custom enrichment field by structure or common name
            // Structure based on user snippet: contains 'checks' and 'final_confidence'
            const enrichmentKey = Object.keys(newItem).find(k =>
                (k === 'custom_enrichment' || k === 'custom_enrichment_data') ||
                (typeof newItem[k] === 'object' && newItem[k] && 'checks' in newItem[k] && 'final_confidence' in newItem[k])
            );

            if (enrichmentKey && newItem[enrichmentKey]) {
                const enrichment = newItem[enrichmentKey];
                delete newItem[enrichmentKey]; // Remove redundant parent

                Object.keys(enrichment).forEach(k => {
                    if (k === 'checks' && typeof enrichment[k] === 'object' && enrichment[k]) {
                        // Flatten checks object
                        // User requested: "make these key value pairs as separte columns" 
                        // and "remove reducntant fields" (the container 'checks')
                        Object.assign(newItem, enrichment[k]);
                    } else {
                        newItem[k] = enrichment[k];
                    }
                });
            }
            return newItem;
        };

        if (Array.isArray(data)) return data.map(processItem);
        return processItem(data);
    };

    const handleApiExport = async () => {
        const dataToExport = rows.map(r => ({
            ...r.originalData,
            'Prospect Name': r.name,
            'Prospect Company': r.company,
            'Enriched Email': r.email || 'N/A',
            'LinkedIn URL': r.linkedinUrl || 'N/A',
            'Status': r.status
        }));

        try {
            const response = await fetch('https://3539-164-52-216-254.ngrok-free.app/enrich', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToExport),
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const responseClone = response.clone();
            const responseBlob = await response.blob();
            const url = window.URL.createObjectURL(responseBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '10xmailmatch_api_result.json';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            alert('Successfully synced data to API and downloaded response!');
            setShowExportModal(false);

            try {
                const jsonData = await responseClone.json();
                const processedData = processApiData(jsonData);
                setApiResponseData(processedData);
                setShowApiResultModal(true);

                // Save to Supabase api_sync_results (individual rows)
                if (session?.user?.id) {
                    const items = Array.isArray(processedData) ? processedData : [processedData];
                    const rowsToInsert = items.map(item => ({
                        user_id: session.user.id,
                        history_id: currentHistoryId,
                        feature: appMode,
                        name: item["Name"],
                        company: item["Company"],
                        status: item["Status"],
                        email_used: item["email_used"],
                        mx_present: item["mx_present"],
                        explanation: item["explanation"],
                        linkedin_url: item["LinkedIn URL"],
                        risk_signals: item["risk_signals"],
                        syntax_valid: item["syntax_valid"],
                        prospect_name: item["Prospect Name"],
                        enriched_email: item["Enriched Email"],
                        recommendation: item["recommendation"],
                        local_part_risk: item["local_part_risk"],
                        prospect_company: item["Prospect Company"],
                        final_confidence: item["final_confidence"],
                        disposable_domain: item["disposable_domain"],
                        possible_typo_domain: item["possible_typo_domain"]
                    }));

                    await supabase.from('api_sync_results').insert(rowsToInsert);

                    // Update local history synced status
                    setHistory(prev => ({
                        ...prev,
                        [appMode]: prev[appMode].map(e => {
                            if (e.id === currentHistoryId) {
                                const newData = e.data ? [...e.data] : [];
                                if (newData.length > 0) newData[0] = { ...newData[0], synced: true };
                                return { ...e, synced: true, data: newData };
                            }
                            return e;
                        })
                    }));

                    // Persist synced status by updating the 'data' JSONB column
                    // We can't rely on a 'synced' column existing, so we store it in the data blob
                    const { data: currentSyncData } = await supabase.from('history').select('data').eq('id', currentHistoryId).single();
                    if (currentSyncData && currentSyncData.data && currentSyncData.data.length > 0) {
                        const newData = [...currentSyncData.data];
                        newData[0] = { ...newData[0], synced: true };
                        const { error: updateError } = await supabase.from('history').update({ data: newData }).eq('id', currentHistoryId);
                        console.log(`Updated bulk sync status for ${currentHistoryId}`, { updateError, newData });
                    } else {
                        console.warn(`Could not update sync status: data array missing for ${currentHistoryId}`, currentSyncData);
                    }
                }
            } catch (err) {
                console.error("Failed to parse API response for display", err);
            }
        } catch (err) {
            alert('Failed to sync data to API.');
            console.error(err);
        }
    };

    const handleSingleApiExport = async () => {
        if (!singleResult) return;

        const dataToExport = [{
            'Prospect Name': singleName,
            'Prospect Company': singleCompany,
            'Enriched Email': singleResult.email || (appMode === 'verify' ? singleEmail : 'N/A'),
            'LinkedIn URL': singleResult.linkedinUrl || 'N/A',
            'Status': singleResult.status,
            'Message': singleResult.message
        }];

        try {
            const response = await fetch('https://3539-164-52-216-254.ngrok-free.app/enrich', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToExport),
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const responseClone = response.clone();
            const responseBlob = await response.blob();
            const url = window.URL.createObjectURL(responseBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '10xmailmatch_single_result.json';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            alert('Successfully synced single result to API and downloaded response!');

            try {
                const jsonData = await responseClone.json();
                const processedData = processApiData(jsonData);
                setApiResponseData(processedData);
                setShowApiResultModal(true);

                // Save to Supabase api_sync_results (individual rows)
                if (session?.user?.id) {
                    const items = Array.isArray(processedData) ? processedData : [processedData];
                    const rowsToInsert = items.map(item => ({
                        user_id: session.user.id,
                        history_id: currentHistoryId,
                        feature: appMode,
                        name: item["Name"],
                        company: item["Company"],
                        status: item["Status"],
                        email_used: item["email_used"],
                        mx_present: item["mx_present"],
                        explanation: item["explanation"],
                        linkedin_url: item["LinkedIn URL"],
                        risk_signals: item["risk_signals"],
                        syntax_valid: item["syntax_valid"],
                        prospect_name: item["Prospect Name"],
                        enriched_email: item["Enriched Email"],
                        recommendation: item["recommendation"],
                        local_part_risk: item["local_part_risk"],
                        prospect_company: item["Prospect Company"],
                        final_confidence: item["final_confidence"],
                        disposable_domain: item["disposable_domain"],
                        possible_typo_domain: item["possible_typo_domain"]
                    }));

                    await supabase.from('api_sync_results').insert(rowsToInsert);

                    // Update local history synced status
                    setHistory(prev => ({
                        ...prev,
                        [appMode]: prev[appMode].map(e => {
                            if (e.id === currentHistoryId) {
                                const newData = e.data ? [...e.data] : [];
                                if (newData.length > 0) newData[0] = { ...newData[0], synced: true };
                                return { ...e, synced: true, data: newData };
                            }
                            return e;
                        })
                    }));

                    // Persist synced status by updating the 'data' JSONB column
                    const { data: currentSyncData } = await supabase.from('history').select('data').eq('id', currentHistoryId).single();
                    if (currentSyncData && currentSyncData.data && currentSyncData.data.length > 0) {
                        const newData = [...currentSyncData.data];
                        newData[0] = { ...newData[0], synced: true };
                        const { error: updateError } = await supabase.from('history').update({ data: newData }).eq('id', currentHistoryId);
                        console.log(`Updated single sync status for ${currentHistoryId}`, { updateError, newData });
                    } else {
                        console.warn(`Could not update sync status: data array missing for ${currentHistoryId}`, currentSyncData);
                    }
                }
            } catch (err) {
                console.error("Failed to parse API response for display", err);
            }
        } catch (err) {
            alert('Failed to sync single result to API.');
            console.error(err);
        }
    };

    const handleGetApiResults = async () => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isHistoryIdValid = currentHistoryId && uuidRegex.test(currentHistoryId);

        setIsProcessing(true);
        try {
            let data: any[] | null = null;
            let error: any = null;

            // 1. Try fetching by current history_id first
            if (isHistoryIdValid) {
                const result = await supabase
                    .from('api_sync_results')
                    .select('*')
                    .eq('history_id', currentHistoryId);
                data = result.data;
                error = result.error;
            }

            // 2. Global Fallback: If no results by history_id, search by input values (Global Sync Lookup)
            if (!data || data.length === 0) {
                let globalQuery = supabase.from('api_sync_results').select('*');

                if (inputMode === 'single') {
                    if (appMode === 'verify') {
                        globalQuery = globalQuery.ilike('email_used', singleEmail.trim());
                    } else {
                        globalQuery = globalQuery
                            .ilike('prospect_name', singleName.trim())
                            .ilike('prospect_company', singleCompany.trim());
                    }
                } else {
                    // For bulk, filter for results matching any row in the current list
                    const names = rows.map(r => r.name.trim()).filter(Boolean);
                    const companies = rows.map(r => r.company.trim()).filter(Boolean);
                    const emails = rows.map(r => r.email?.trim()).filter(Boolean);

                    if (appMode === 'verify') {
                        if (emails.length > 0) globalQuery = globalQuery.in('email_used', emails);
                        else { setIsProcessing(false); alert("No data to match."); return; }
                    } else {
                        if (names.length > 0) globalQuery = globalQuery.in('prospect_name', names).in('prospect_company', companies);
                        else { setIsProcessing(false); alert("No data to match."); return; }
                    }
                }

                const result = await globalQuery;
                data = result.data;
                error = result.error;
            }

            if (error) throw error;

            if (!data || data.length === 0) {
                alert("No API results found for this entry or session.");
                return;
            }

            // Filter out internal metadata columns for display
            const filteredData = data.map(item => {
                const { id, user_id, history_id, feature, created_at, ...rest } = item;
                return rest;
            });

            setApiResponseData(filteredData);
            setShowApiResultModal(true);
        } catch (err) {
            console.error("Failed to fetch API results:", err);
            alert("Failed to fetch API results.");
        } finally {
            setIsProcessing(false);
        }
    };

    const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

    const themeClasses = {
        bg: theme === 'dark' ? 'bg-[#0f0720]' : 'bg-[#f8fafc]',
        text: theme === 'dark' ? 'text-violet-100' : 'text-slate-900',
        glass: theme === 'dark' ? 'glass-dark' : 'bg-white/80 backdrop-blur-xl border border-white/20',
        header: theme === 'dark' ? 'glass-dark border-violet-800/30' : 'bg-white/90 border-slate-200 shadow-sm backdrop-blur-md',
        card: theme === 'dark' ? 'glass-dark' : 'bg-white border border-slate-100 shadow-lg',
        input: theme === 'dark' ? 'bg-violet-950/40 border-violet-800/50 text-white' : 'bg-slate-50 border-slate-200 text-slate-900',
        label: theme === 'dark' ? 'text-violet-400' : 'text-slate-600',
        sidebarText: theme === 'dark' ? 'text-violet-200' : 'text-slate-700',
        tableHeader: theme === 'dark' ? 'bg-[#150b2e]' : 'bg-slate-50 border-b border-slate-100',
        tableRow: theme === 'dark' ? 'hover:bg-violet-900/40' : 'hover:bg-blue-50/50',
        tableCell: theme === 'dark' ? 'bg-violet-900/20' : 'bg-white',
        statusPending: theme === 'dark' ? 'text-violet-400/30' : 'text-slate-400'
    };

    const handleTabSwitch = (mode: 'enrich' | 'verify' | 'linkedin' | 'event-scraper') => {
        if (appMode !== mode) {
            if (mode === 'linkedin' || appMode === 'linkedin') setResultsFromFinder([]);
            setAppMode(mode);
            setFile(null);
            setRows([]);
            setHeaders([]);
            setMapping(null);
            setSingleResult(null);
            setSingleName('');
            setSingleCompany('');
            setSingleEmail('');
            setError(null);
            setIsHistoryView(false);
            setShowExportModal(false);
            setShowSettingsMenu(false);
        }
    };

    const handleImportFromFinder = () => {
        if (resultsFromFinder.length === 0) return;
        const rowsToVerify: ProspectRow[] = resultsFromFinder.filter(r => !!r.email).map(r => ({
            ...r,
            status: 'pending',
            originalData: { ...r.originalData, 'Found Email': r.email!, 'Found Name': r.name, 'Found Company': r.company }
        }));
        setRows(rowsToVerify);
        setHeaders(['Found Email', 'Found Name', 'Found Company']);
        setMapping({ nameHeader: 'Found Name', companyHeader: 'Found Company', emailHeader: 'Found Email' });
        setFile(new File([], "Enriched Emails List"));
    };

    const handleImportFromScraper = (targetMode: 'enrich' | 'linkedin') => {
        if (lastScrapedResults.length === 0) return;
        const newRows: ProspectRow[] = lastScrapedResults.map((s, idx) => ({
            id: `scraped-import-${idx}`,
            name: s.name,
            company: s.company,
            status: 'pending',
            originalData: { 'Scraped Name': s.name, 'Scraped Company': s.company, 'Role': s.role || '' }
        }));

        setAppMode(targetMode);
        setRows(newRows);
        setHeaders(['Scraped Name', 'Scraped Company', 'Role']);
        setMapping({ nameHeader: 'Scraped Name', companyHeader: 'Scraped Company' });
        setFile(new File([], "Imported Scraper Leads"));
    };

    const handleScrape = async () => {
        if (!eventUrl) return;
        setIsScraping(true);
        setError(null);
        setScrapedSpeakers([]);

        try {
            const result = await scrapeEvent(eventUrl);
            if (result.success) {
                setScrapedSpeakers(result.speakers);
                setLastScrapedResults(result.speakers);
                if (result.speakers.length === 0) {
                    setError("No speakers found on this page. Try a different URL or page.");
                }
            } else {
                setError(result.message || "Failed to scrape page.");
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred during scraping.");
        } finally {
            setIsScraping(false);
        }
    };

    const handleProcessLeads = () => {
        if (scrapedSpeakers.length === 0) return;
        setLastScrapedResults(scrapedSpeakers);
        handleImportFromScraper('enrich');
        setScrapedSpeakers([]);
        setEventUrl('');
    };


    if (isInitialAuthCheck) {
        return (
            <div className={cn("min-h-screen w-full flex flex-col items-center justify-center p-4 transition-colors duration-500", theme === 'dark' ? "bg-slate-900" : "bg-[#f5f0e1]")}>
                <BackgroundBoxes className="opacity-40" />
                <div className="relative z-30 flex flex-col items-center">
                    <div className="bg-violet-600 p-4 rounded-3xl mb-6 shadow-2xl shadow-violet-600/40 animate-pulse">
                        <Mail className="w-10 h-10 text-white" />
                    </div>
                    <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'} tracking-tight mb-2 uppercase tracking-[0.2em]`}>10xMailMatch</h1>
                    <div className="flex items-center gap-2 mt-4">
                        <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                        <span className={`text-xs font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-violet-400/60' : 'text-slate-500'}`}>Synchronizing workspace...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className={cn("min-h-screen relative w-full overflow-hidden flex items-center justify-center p-4 transition-colors duration-500", theme === 'dark' ? "bg-slate-900" : "bg-[#f5f0e1]")}>
                <BackgroundBoxes className="opacity-60" />
                <div className={cn("absolute inset-0 w-full h-full z-20 [mask-image:radial-gradient(transparent,white)] pointer-events-none", theme === 'dark' ? "bg-slate-900/30" : "bg-[#f5f0e1]/30")} />
                <div className="absolute top-6 right-6 z-30">
                    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`p-2.5 rounded-xl border ${theme === 'dark' ? 'bg-violet-900/40 border-violet-800/50 text-violet-400 hover:text-violet-100' : 'bg-white border-amber-200 text-slate-600 hover:text-slate-900 shadow-sm'} transition-all`}>
                        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                </div>
                <div className={cn(themeClasses.glass, "relative z-30 w-full max-w-md p-6 rounded-3xl animate-fade-in shadow-2xl mx-auto")}>
                    <div className="flex flex-col items-center mb-6">
                        <div className="bg-violet-600 p-2.5 rounded-2xl mb-3 shadow-lg shadow-violet-600/20"><Mail className="w-6 h-6 text-white" /></div>
                        <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'} tracking-tight`}>10xMailMatch</h1>
                        <p className={`${theme === 'dark' ? 'text-violet-300/60' : 'text-slate-500'} text-xs mt-1`}>{authMode === 'login' ? 'Sign in to your workspace' : 'Create your free account'}</p>
                    </div>
                    <form onSubmit={handleAuth} className="space-y-4">
                        {authMode === 'signup' && (
                            <div>
                                <label className={`block text-[10px] font-bold ${themeClasses.label} uppercase tracking-widest mb-1.5 ml-1`}>Full Name</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User className={`h-4 w-4 ${theme === 'dark' ? 'text-violet-400/50' : 'text-slate-400'}`} /></div>
                                    <input type="text" required className={`w-full ${themeClasses.input} rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none transition-all`} value={authName} onChange={(e) => setAuthName(e.target.value)} />
                                </div>
                            </div>
                        )}
                        <div>
                            <label className={`block text-[10px] font-bold ${themeClasses.label} uppercase tracking-widest mb-1.5 ml-1`}>Email</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail className={`h-4 w-4 ${theme === 'dark' ? 'text-violet-400/50' : 'text-slate-400'}`} /></div>
                                <input type="email" required className={`w-full ${themeClasses.input} rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none transition-all`} value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <label className={`block text-[10px] font-bold ${themeClasses.label} uppercase tracking-widest mb-1.5 ml-1`}>Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className={`h-4 w-4 ${theme === 'dark' ? 'text-violet-400/50' : 'text-slate-400'}`} /></div>
                                <input type="password" required className={`w-full ${themeClasses.input} rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none transition-all`} value={authPass} onChange={(e) => setAuthPass(e.target.value)} />
                            </div>
                        </div>
                        <button type="submit" disabled={isAuthLoading} className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-violet-600/30 flex items-center justify-center gap-2 text-sm">
                            {isAuthLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (authMode === 'login' ? 'Sign In' : 'Sign Up')} <ArrowRight className="w-4 h-4" />
                        </button>
                    </form>
                    {error && (
                        <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 animate-fade-in">
                            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                            <p className="text-[11px] text-rose-500 font-medium leading-relaxed">{error}</p>
                        </div>
                    )}
                    <div className="mt-6 text-center">
                        <button onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setError(null); }} className={`text-xs font-medium ${theme === 'dark' ? 'text-violet-400 hover:text-violet-200' : 'text-violet-600 hover:text-violet-800'} transition-colors`}>{authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen flex flex-col ${themeClasses.text} relative transition-colors duration-500 overflow-hidden`}>
            {/* Background Decorative Layer */}
            <div className={`fixed inset-0 pointer-events-none z-0 overflow-hidden ${themeClasses.bg}`}>
                <BackgroundBoxes className="opacity-40" />
                <div className={cn("absolute inset-0 w-full h-full [mask-image:radial-gradient(transparent,white)]", theme === 'dark' ? "bg-slate-900/30" : "bg-[#f5f0e1]/30")} />
            </div>

            <header className={`${themeClasses.header} border-b fixed top-0 left-0 right-0 z-[1000] px-6 h-20 flex items-center justify-between transition-all duration-300 pointer-events-auto shadow-sm`}>
                <div className="flex items-center gap-3">
                    <div className="bg-violet-600 p-2 rounded-xl shadow-lg shadow-violet-600/20"><Mail className="w-5 h-5 text-white" /></div>
                    <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'} tracking-tight`}>10xMailMatch</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className={`flex ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'} p-1 rounded-xl border`}>
                        <button onClick={() => handleTabSwitch('enrich')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${appMode === 'enrich' ? 'bg-violet-600 text-white shadow-lg' : theme === 'dark' ? 'text-violet-400 hover:text-violet-200' : 'text-slate-500 hover:text-slate-700'}`}>Email Finder</button>
                        <button onClick={() => handleTabSwitch('verify')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${appMode === 'verify' ? 'bg-violet-600 text-white shadow-lg' : theme === 'dark' ? 'text-violet-400 hover:text-violet-200' : 'text-slate-500 hover:text-slate-700'}`}>Email Verifier</button>
                        <button onClick={() => handleTabSwitch('linkedin')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${appMode === 'linkedin' ? 'bg-blue-600 text-white shadow-lg' : theme === 'dark' ? 'text-violet-400 hover:text-violet-200' : 'text-slate-500 hover:text-slate-700'}`}>LinkedIn Finder</button>
                        <button onClick={() => handleTabSwitch('event-scraper')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${appMode === 'event-scraper' ? 'bg-emerald-600 text-white shadow-lg' : theme === 'dark' ? 'text-violet-400 hover:text-violet-200' : 'text-slate-500 hover:text-slate-700'}`}>Event Scraper</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`p-2 rounded-xl border ${theme === 'dark' ? 'bg-violet-900/40 border-violet-800/50 text-violet-400 hover:text-violet-100' : 'bg-white border-amber-200 text-slate-600 hover:text-slate-900'} transition-all`}>{theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>

                        {/* Settings Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                                className={`p-2 rounded-xl border ${theme === 'dark' ? 'bg-violet-900/40 border-violet-800/50 text-violet-400 hover:text-violet-100' : 'bg-white border-amber-200 text-slate-600 hover:text-slate-900'} transition-all`}
                            >
                                <Settings className="w-5 h-5" />
                            </button>

                            <AnimatePresence>
                                {showSettingsMenu && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className={`absolute right-0 top-full mt-2 w-64 p-4 rounded-2xl border ${themeClasses.card} shadow-xl z-50 flex flex-col gap-3`}
                                    >
                                        <div className="flex flex-col gap-1 pb-3 border-b border-gray-500/10">
                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${themeClasses.label}`}>Signed in as</span>
                                            <p className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{session?.user?.email}</p>
                                        </div>

                                        <button
                                            onClick={() => { setShowSettingsMenu(false); setShowLogoutConfirm(true); }}
                                            className={`flex items-center gap-2 px-4 py-2.5 ${theme === 'dark' ? 'bg-rose-900/20 hover:bg-rose-900/40 text-rose-400' : 'bg-rose-50 hover:bg-rose-100 text-rose-600'} rounded-xl text-sm font-bold transition-all w-full`}
                                        >
                                            <LogOut className="w-4 h-4" /> Sign Out
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </header>

            <AnimatePresence>
                {showLogoutConfirm && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`${themeClasses.card} max-w-sm w-full p-6 rounded-[2rem] border-violet-800/50 shadow-2xl text-center mx-auto`}>
                            <div className="bg-rose-600/20 p-3 rounded-2xl w-fit mx-auto mb-4"><LogOut className="w-6 h-6 text-rose-500" /></div>
                            <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'} mb-1`}>Sign Out</h3>
                            <p className={`${theme === 'dark' ? 'text-violet-300/70' : 'text-slate-500'} text-xs mb-6`}>Are you sure you want to sign out?</p>
                            <div className="flex flex-col gap-2.5">
                                <button onClick={performLogout} className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all text-sm">Yes, Sign Me Out</button>
                                <button onClick={() => setShowLogoutConfirm(false)} className={`w-full py-2.5 ${theme === 'dark' ? 'bg-violet-900/40 hover:bg-violet-900/60 text-violet-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'} font-bold rounded-xl transition-all text-sm`}>Cancel</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {showExportModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`${themeClasses.card} max-w-md w-full p-8 rounded-[2.5rem] border-violet-800/50 shadow-2xl relative`}>
                            <button onClick={() => setShowExportModal(false)} className="absolute top-6 right-6 p-2 rounded-xl hover:bg-white/10 transition-colors">
                                <X className={`w-5 h-5 ${theme === 'dark' ? 'text-violet-400' : 'text-slate-500'}`} />
                            </button>

                            <div className="flex flex-col items-center text-center mb-8">
                                <div className="bg-emerald-600/20 p-4 rounded-2xl mb-4">
                                    <Download className="w-8 h-8 text-emerald-500" />
                                </div>
                                <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Export Data</h3>
                                <p className={`${theme === 'dark' ? 'text-violet-300/60' : 'text-slate-500'} text-sm mt-1`}>Choose your preferred format for the {rows.length} records found.</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button onClick={downloadResults} className={`group flex flex-col items-center p-6 rounded-3xl border-2 transition-all duration-300 ${theme === 'dark' ? 'bg-white/5 border-violet-800/30 hover:border-emerald-500/50 hover:bg-emerald-500/5' : 'bg-white border-slate-200 hover:border-emerald-500 hover:bg-emerald-50'}`}>
                                    <FileSpreadsheet className="w-10 h-10 text-emerald-500 mb-3 group-hover:scale-110 transition-transform" />
                                    <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'} text-sm`}>Excel</span>
                                    <span className="text-[10px] opacity-40 uppercase font-black tracking-widest mt-1">.xlsx format</span>
                                </button>
                                <button onClick={downloadResultsJSON} className={`group flex flex-col items-center p-6 rounded-3xl border-2 transition-all duration-300 ${theme === 'dark' ? 'bg-white/5 border-violet-800/30 hover:border-violet-500/50 hover:bg-violet-500/5' : 'bg-white border-slate-200 hover:border-violet-500 hover:bg-violet-50'}`}>
                                    <Layers className="w-10 h-10 text-violet-500 mb-3 group-hover:scale-110 transition-transform" />
                                    <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'} text-sm`}>JSON</span>
                                    <span className="text-[10px] opacity-40 uppercase font-black tracking-widest mt-1">.json format</span>
                                </button>

                                {!isHistoryView && appMode === 'enrich' && (
                                    <>
                                        <button onClick={handleApiExport} className={`group flex flex-col items-center p-6 rounded-3xl border-2 transition-all duration-300 md:col-span-2 ${theme === 'dark' ? 'bg-white/5 border-violet-800/30 hover:border-blue-500/50 hover:bg-blue-500/5' : 'bg-white border-slate-200 hover:border-blue-500 hover:bg-blue-50'}`}>
                                            <Webhook className="w-10 h-10 text-blue-500 mb-3 group-hover:scale-110 transition-transform" />
                                            <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'} text-sm`}>Sync to API</span>
                                            <span className="text-[10px] opacity-40 uppercase font-black tracking-widest mt-1">POST to Webhook</span>
                                        </button>
                                        <button onClick={() => { setShowExportModal(false); setAppMode('verify'); handleImportFromFinder(); }} className={`group flex flex-col items-center p-6 rounded-3xl border-2 transition-all duration-300 md:col-span-2 ${theme === 'dark' ? 'bg-white/5 border-violet-800/30 hover:border-violet-500/50 hover:bg-violet-500/5' : 'bg-white border-slate-200 hover:border-violet-500 hover:bg-violet-50'}`}>
                                            <ShieldCheck className="w-10 h-10 text-violet-500 mb-3 group-hover:scale-110 transition-transform" />
                                            <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'} text-sm`}>Verify Emails</span>
                                            <span className="text-[10px] opacity-40 uppercase font-black tracking-widest mt-1">Check Validity</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {showApiResultModal && apiResponseData && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className={`${themeClasses.card} max-w-4xl w-full p-8 rounded-[2.5rem] border-violet-800/50 shadow-2xl relative max-h-[80vh] flex flex-col`}>
                            <button onClick={() => setShowApiResultModal(false)} className="absolute top-6 right-6 p-2 rounded-xl hover:bg-white/10 transition-colors">
                                <X className={`w-5 h-5 ${theme === 'dark' ? 'text-violet-400' : 'text-slate-500'}`} />
                            </button>

                            <div className="flex flex-col items-center text-center mb-6 shrink-0">
                                <div className="bg-blue-600/20 p-4 rounded-2xl mb-4">
                                    <Webhook className="w-8 h-8 text-blue-500" />
                                </div>
                                <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>API Sync Results</h3>
                                <p className={`${theme === 'dark' ? 'text-violet-300/60' : 'text-slate-500'} text-sm mt-1`}>Data returned from the endpoint.</p>
                            </div>

                            <div className={`flex-1 overflow-auto custom-scrollbar border rounded-2xl p-4 ${theme === 'dark' ? 'bg-black/5 border-white/10' : 'bg-white border-slate-200 shadow-inner'}`}>
                                {Array.isArray(apiResponseData) ? (
                                    apiResponseData.length === 0 ? <p className="text-center opacity-50">Empty List</p> : (
                                        <table className="w-full text-left border-collapse text-sm">
                                            <thead>
                                                <tr>
                                                    {Object.keys(apiResponseData[0] || {}).map(k => (
                                                        <th key={k} className={`p-4 border-b ${theme === 'dark' ? 'border-white/10 text-violet-300' : 'border-slate-100 text-slate-900'} font-bold text-xs uppercase tracking-wider bg-slate-50/50`}>{k}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {apiResponseData.map((row: any, i: number) => (
                                                    <tr key={i} className={`group ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'} transition-colors`}>
                                                        {Object.keys(apiResponseData[0] || {}).map(k => (
                                                            <td key={`${i}-${k}`} className={`p-4 border-b ${theme === 'dark' ? 'border-white/10 text-violet-100' : 'border-slate-50 text-slate-800'}`}>
                                                                {typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k])}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )
                                ) : typeof apiResponseData === 'object' ? (
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead>
                                            <tr>
                                                <th className={`p-4 border-b ${theme === 'dark' ? 'border-white/10 text-violet-300' : 'border-slate-100 text-slate-900'} font-bold text-xs uppercase tracking-wider bg-slate-50/50`}>Key</th>
                                                <th className={`p-4 border-b ${theme === 'dark' ? 'border-white/10 text-violet-300' : 'border-slate-100 text-slate-900'} font-bold text-xs uppercase tracking-wider bg-slate-50/50`}>Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(apiResponseData).map(([k, v]) => (
                                                <tr key={k} className={`group ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-black/5'} transition-colors`}>
                                                    <td className={`p-3 border-b ${theme === 'dark' ? 'border-white/10 text-violet-400' : 'border-black/10 text-slate-600'} font-medium`}>{k}</td>
                                                    <td className={`p-3 border-b ${theme === 'dark' ? 'border-white/10 text-violet-100' : 'border-black/10 text-slate-800'}`}>
                                                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <pre className="text-xs font-mono">{JSON.stringify(apiResponseData, null, 2)}</pre>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-2 pt-28 animate-fade-in relative z-10">
                {!file ? (
                    appMode === 'event-scraper' ? (
                        <div className="w-full max-w-4xl mx-auto space-y-8">
                            {/* URL Input Section */}
                            <div className={`${themeClasses.card} p-8 rounded-[2rem] border border-violet-800/10 shadow-xl text-center relative overflow-hidden`}>
                                {isScraping && (
                                    <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-sm ${theme === 'dark' ? 'bg-black/60' : 'bg-white/60'} animate-fade-in`}>
                                        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-3" />
                                        <h4 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Scanning Page...</h4>
                                        <p className={`text-sm ${theme === 'dark' ? 'text-violet-300' : 'text-slate-600'} mt-1`}>This may take a few moments.</p>
                                    </div>
                                )}
                                <div className="flex flex-col items-center mb-6">
                                    <div className="bg-emerald-600/10 p-3 rounded-2xl mb-3"><Globe className="w-8 h-8 text-emerald-600" /></div>
                                    <h3 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Event Web Scraper</h3>
                                    <p className={`${theme === 'dark' ? 'text-violet-300/60' : 'text-slate-500'} mt-2 max-w-md`}>Enter an event page URL to automatically extract speakers and attendees for enrichment.</p>
                                </div>

                                <div className="relative max-w-2xl mx-auto">
                                    <input
                                        type="url"
                                        placeholder="https://example.com/event-page"
                                        className={`w-full pl-6 pr-32 py-4 ${themeClasses.input} rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm shadow-inner`}
                                        value={eventUrl}
                                        onChange={(e) => setEventUrl(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
                                        disabled={isScraping}
                                    />
                                    <button
                                        onClick={handleScrape}
                                        disabled={isScraping || !eventUrl}
                                        className="absolute right-2 top-2 bottom-2 px-6 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 text-xs"
                                    >
                                        {isScraping ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Scrape Page'}
                                    </button>
                                </div>
                            </div>

                            {/* Scraped Results Section */}
                            {scrapedSpeakers.length > 0 && (
                                <div className={`${themeClasses.card} rounded-[2rem] overflow-hidden flex flex-col shadow-2xl animate-fade-in`}>
                                    <div className={`px-8 py-6 border-b ${theme === 'dark' ? 'border-white/10' : 'border-black/5'} flex justify-between items-center bg-emerald-600/5`}>
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-600 rounded-lg shadow-lg shadow-emerald-600/20"><Users className="w-5 h-5 text-white" /></div>
                                            <div>
                                                <h4 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Scraped Leads</h4>
                                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{scrapedSpeakers.length} Found</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleProcessLeads}
                                            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-violet-600/30 flex items-center gap-2 text-xs"
                                        >
                                            Process Leads <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-0">
                                        <table className="w-full text-left border-collapse">
                                            <thead className={`sticky top-0 z-10 ${theme === 'dark' ? 'bg-[#0f0720]' : 'bg-white'}`}>
                                                <tr>
                                                    <th className={`px-6 py-4 text-[10px] font-bold ${themeClasses.label} uppercase tracking-[0.2em] border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-100'}`}>Name</th>
                                                    <th className={`px-6 py-4 text-[10px] font-bold ${themeClasses.label} uppercase tracking-[0.2em] border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-100'}`}>Company</th>
                                                    <th className={`px-6 py-4 text-[10px] font-bold ${themeClasses.label} uppercase tracking-[0.2em] border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-100'}`}>Role</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {scrapedSpeakers.map((speaker, i) => (
                                                    <tr key={i} className={`group ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-50'} transition-colors border-b ${theme === 'dark' ? 'border-white/5' : 'border-slate-50'} last:border-0`}>
                                                        <td className={`px-6 py-3 text-sm font-bold ${theme === 'dark' ? 'text-violet-100' : 'text-slate-700'}`}>{speaker.name}</td>
                                                        <td className={`px-6 py-3 text-sm ${theme === 'dark' ? 'text-violet-300' : 'text-slate-600'}`}>{speaker.company || '—'}</td>
                                                        <td className={`px-6 py-3 text-xs font-mono opacity-70 ${theme === 'dark' ? 'text-violet-400' : 'text-slate-500'}`}>{speaker.role || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
                            <div className="lg:col-span-2 space-y-4">
                                <div className={`${themeClasses.card} p-5 rounded-3xl overflow-hidden flex flex-col h-[calc(100vh-18rem)] min-h-[550px]`}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <HistoryIcon className="w-4 h-4 text-violet-500" />
                                        <h3 className={`text-sm font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Recent activity</h3>
                                    </div>
                                    <div className="flex gap-4 flex-1 overflow-hidden mb-4">
                                        {/* Bulk Section */}
                                        <div className="flex-1 flex flex-col min-w-0">
                                            <h4 className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 mb-2 ${theme === 'dark' ? 'text-violet-400/50' : 'text-slate-400'} sticky top-0 z-10 ${theme === 'dark' ? 'bg-[#0f0720]' : 'bg-white'}`}>Bulk Uploads</h4>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                                                {history[appMode].some(e => e.type === 'bulk') ? (
                                                    history[appMode].filter(e => e.type === 'bulk').map(entry => (
                                                        <div key={entry.id} onClick={() => loadHistorySession(entry)} className={`p-2.5 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-violet-500/50' : 'bg-black/5 border-black/10 hover:bg-black/10 hover:border-violet-500/50'} transition-all cursor-pointer group/item active:scale-95`}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <div className="flex items-center gap-1 opacity-40"><Clock className="w-2.5 h-2.5" /><span className="text-[9px]">{new Date(entry.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                                                            </div>
                                                            <p className={`text-[12px] font-bold ${theme === 'dark' ? 'text-violet-100 group-hover/item:text-violet-400' : 'text-slate-700 group-hover/item:text-violet-600'} truncate mb-0.5`}>{formatHistoryInput(entry)}</p>
                                                            <div className="flex flex-col gap-1 mt-1">
                                                                <div className="flex items-center gap-2">
                                                                    <p className={`text-[10px] font-mono ${entry.status.toLowerCase().includes('fail') ? 'text-rose-500' : 'text-emerald-500'} truncate`}>{formatHistoryResult(entry.result)}</p>
                                                                    {entry.hasCached && (
                                                                        <span className={`text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border transition-all ${theme === 'dark' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-violet-50 text-violet-600 border-violet-200'}`}>Already Processed</span>
                                                                    )}
                                                                    {entry.synced && (
                                                                        <span className={`text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border transition-all ${theme === 'dark' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>Synced</span>
                                                                    )}
                                                                </div>
                                                                {entry.hasCached && entry.cachedAt && (
                                                                    <span className={`text-[8px] font-medium opacity-50 ${theme === 'dark' ? 'text-violet-300' : 'text-slate-500'}`}>
                                                                        Ran on {new Date(entry.cachedAt).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}  {entry.cachedType ? `via ${entry.cachedType === 'bulk' ? 'Bulk Upload' : 'Single Try'}` : ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-center py-6 opacity-20 text-[8px] uppercase font-bold tracking-widest">None</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Single Section */}
                                        <div className="flex-1 flex flex-col min-w-0">
                                            <h4 className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 mb-2 ${theme === 'dark' ? 'text-violet-400/50' : 'text-slate-400'} sticky top-0 z-10 ${theme === 'dark' ? 'bg-[#0f0720]' : 'bg-white'}`}>Single Try</h4>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                                                {history[appMode].some(e => e.type === 'single') ? (
                                                    history[appMode].filter(e => e.type === 'single').map(entry => (
                                                        <div key={entry.id} onClick={() => loadHistorySession(entry)} className={`p-2.5 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-violet-500/50' : 'bg-black/5 border-black/10 hover:bg-black/10 hover:border-violet-500/50'} transition-all cursor-pointer group/item active:scale-95`}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <div className="flex items-center gap-1 opacity-40"><Clock className="w-2.5 h-2.5" /><span className="text-[9px]">{new Date(entry.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                                                            </div>
                                                            <p className={`text-[12px] font-bold ${theme === 'dark' ? 'text-violet-100 group-hover/item:text-violet-400' : 'text-slate-700 group-hover/item:text-violet-600'} truncate mb-0.5`}>{formatHistoryInput(entry)}</p>
                                                            <div className="flex flex-col gap-1 mt-1">
                                                                <div className="flex items-center gap-2">
                                                                    <p className={`text-[10px] font-mono ${entry.status.toLowerCase().includes('fail') ? 'text-rose-500' : 'text-emerald-500'} truncate`}>{formatHistoryResult(entry.result)}</p>
                                                                    {entry.hasCached && (
                                                                        <span className={`text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border transition-all ${theme === 'dark' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-violet-50 text-violet-600 border-violet-200'}`}>Already Processed</span>
                                                                    )}
                                                                    {entry.synced && (
                                                                        <span className={`text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border transition-all ${theme === 'dark' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>Synced</span>
                                                                    )}
                                                                </div>
                                                                {entry.hasCached && entry.cachedAt && (
                                                                    <span className={`text-[8px] font-medium opacity-50 ${theme === 'dark' ? 'text-violet-300' : 'text-slate-500'}`}>
                                                                        Ran on {new Date(entry.cachedAt).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}  {entry.cachedType ? `via ${entry.cachedType === 'bulk' ? 'Bulk Upload' : 'Single Try'}` : ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-center py-6 opacity-20 text-[8px] uppercase font-bold tracking-widest">None</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* App Note to cover the space */}
                                    <div className={`mt-auto p-4 rounded-2xl border ${theme === 'dark' ? 'bg-violet-900/20 border-violet-800/30' : 'bg-violet-50 border-violet-200'} shrink-0`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Info className="w-3.5 h-3.5 text-violet-500" />
                                            <span className={`text-[11px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-violet-300' : 'text-violet-700'}`}>Pro Insight</span>
                                        </div>
                                        <p className={`text-[11px] leading-relaxed ${theme === 'dark' ? 'text-violet-400/80' : 'text-slate-600'}`}>
                                            10xMailMatch is your ultimate intelligence layer for lead generation. Powered by Gemini & GetProspect, we seamlessly enrich outreach with verified business emails and LinkedIn profiles.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="lg:col-span-3 flex flex-col items-center">
                                <div className={`mb-1 p-1.5 rounded-2xl border ${theme === 'dark' ? 'bg-violet-900/20 border-violet-800/40' : 'bg-white border-amber-100'} flex gap-1 shadow-sm`}>
                                    <button onClick={() => setInputMode('bulk')} className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${inputMode === 'bulk' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : theme === 'dark' ? 'text-violet-400 hover:bg-violet-900/30' : 'text-slate-500 hover:bg-slate-50'}`}><Layers className="w-4 h-4" /> Bulk Upload</button>
                                    <button onClick={() => setInputMode('single')} className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${inputMode === 'single' ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' : theme === 'dark' ? 'text-violet-400 hover:bg-violet-900/30' : 'text-slate-500 hover:bg-slate-50'}`}><MousePointer2 className="w-4 h-4" /> Single Try</button>
                                </div>
                                <AnimatePresence mode="wait">
                                    {inputMode === 'bulk' ? (
                                        <motion.div key="bulk" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`w-full flex flex-col items-center justify-center py-8 ${themeClasses.card} rounded-[2rem] border-2 border-dashed ${theme === 'dark' ? 'border-violet-800/40 hover:border-violet-500' : 'border-slate-300 hover:border-violet-400'} transition-all group cursor-pointer relative`}>
                                            <div className={`${theme === 'dark' ? 'bg-violet-900/30' : 'bg-violet-50'} p-5 rounded-2xl mb-4 group-hover:scale-110 transition-transform shadow-xl`}>{appMode === 'enrich' ? <Search className="w-10 h-10 text-violet-600" /> : appMode === 'linkedin' ? <Linkedin className="w-10 h-10 text-blue-500" /> : <ShieldCheck className="w-10 h-10 text-violet-600" />}</div>
                                            <p className={`${theme === 'dark' ? 'text-violet-300/60' : 'text-slate-500'} mb-6 text-center text-sm max-w-md`}>Upload your prospect lists (Excel/CSV) to start the {appMode === 'enrich' ? 'enrichment' : appMode === 'linkedin' ? 'LinkedIn search' : 'verification'} process.</p>
                                            <div className="flex flex-col sm:flex-row gap-4 items-center">
                                                <label className="bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 px-8 rounded-2xl cursor-pointer transition-all shadow-xl hover:shadow-violet-600/30">Select Spreadsheet<input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} /></label>
                                                {appMode === 'verify' && resultsFromFinder.length > 0 && <button onClick={(e) => { e.stopPropagation(); handleImportFromFinder(); }} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-xl hover:shadow-emerald-600/30 flex items-center gap-2"><ArrowLeftRight className="w-4 h-4" /> Use Found Emails</button>}
                                                {lastScrapedResults.length > 0 && (appMode === 'linkedin' || appMode === 'enrich') && <button onClick={(e) => { e.stopPropagation(); handleImportFromScraper(appMode === 'linkedin' ? 'linkedin' : 'enrich'); }} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-xl hover:shadow-emerald-600/30 flex items-center gap-2"><ArrowLeftRight className="w-4 h-4" /> Use Scraped Results</button>}
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div key="single" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`w-full max-w-2xl ${themeClasses.card} p-8 rounded-[2rem] border border-violet-800/10 shadow-xl overflow-hidden`}>
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="w-10" /> {/* Spacer */}
                                                <div className="flex flex-col items-center text-center">
                                                    <div className="bg-violet-600/10 p-2.5 rounded-xl mb-2"><Zap className="w-6 h-6 text-violet-600" /></div>
                                                    <h3 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Individual {appMode === 'verify' ? 'Check' : 'Search'}</h3>
                                                    {singleResult && isHistoryView && appMode === 'enrich' && (
                                                        <button
                                                            onClick={handleGetApiResults}
                                                            className="mt-3 flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-bold text-xs shadow-lg"
                                                        >
                                                            <Webhook className="w-4 h-4" /> Get API Results
                                                        </button>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => { setSingleName(''); setSingleCompany(''); setSingleEmail(''); setSingleResult(null); setIsHistoryView(false); }}
                                                    className={`text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-lg transition-all ${theme === 'dark' ? 'text-rose-400 hover:bg-rose-500/10' : 'text-rose-600 hover:bg-rose-50'}`}
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                            <div className="space-y-4">
                                                {appMode === 'enrich' || appMode === 'linkedin' ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <label className={`block text-[11px] font-bold ${themeClasses.label} uppercase tracking-widest ml-1`}>Name</label>
                                                            <div className="relative">
                                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                                    <User className={`h-5 w-5 ${theme === 'dark' ? 'text-violet-400/50' : 'text-slate-400'}`} />
                                                                </div>
                                                                <input type="text" className={`w-full pl-10 pr-10 py-3.5 ${themeClasses.input} rounded-xl outline-none focus:ring-2 focus:ring-violet-600 transition-all text-sm`} value={singleName} onChange={(e) => setSingleName(e.target.value)} />
                                                                {singleName && (
                                                                    <button onClick={() => setSingleName('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-rose-500 transition-colors">
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className={`block text-[11px] font-bold ${themeClasses.label} uppercase tracking-widest ml-1`}>Company/Domain</label>
                                                            <div className="relative">
                                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                                    <Building2 className={`h-5 w-5 ${theme === 'dark' ? 'text-violet-400/50' : 'text-slate-400'}`} />
                                                                </div>
                                                                <input type="text" className={`w-full pl-10 pr-10 py-3.5 ${themeClasses.input} rounded-xl outline-none focus:ring-2 focus:ring-violet-600 transition-all text-sm`} value={singleCompany} onChange={(e) => setSingleCompany(e.target.value)} />
                                                                {singleCompany && (
                                                                    <button onClick={() => setSingleCompany('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-rose-500 transition-colors">
                                                                        <X className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        <label className={`block text-[11px] font-bold ${themeClasses.label} uppercase tracking-widest ml-1`}>Email</label>
                                                        <div className="relative">
                                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                                <Mail className={`h-5 w-5 ${theme === 'dark' ? 'text-violet-400/50' : 'text-slate-400'}`} />
                                                            </div>
                                                            <input type="email" className={`w-full pl-10 pr-10 py-3.5 ${themeClasses.input} rounded-xl outline-none focus:ring-2 focus:ring-violet-600 transition-all text-sm`} value={singleEmail} onChange={(e) => setSingleEmail(e.target.value)} />
                                                            {singleEmail && (
                                                                <button onClick={() => setSingleEmail('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-rose-500 transition-colors">
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                <button onClick={handleSingleAction} disabled={isProcessing} className="w-full py-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-base">{isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : (appMode === 'enrich' ? 'Find Email' : appMode === 'linkedin' ? 'Find LinkedIn' : 'Verify Email')}</button>
                                                {singleResult && (
                                                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={`mt-4 p-4 rounded-2xl ${theme === 'dark' ? 'bg-violet-950/40 border-violet-800/40' : 'bg-white border-amber-100'} border flex flex-col items-center text-center`}>
                                                        <div className="flex flex-col items-center gap-2 w-full">
                                                            {singleResult.email && <div className="flex flex-col items-center w-full"><span className={`text-[9px] font-bold ${themeClasses.label} uppercase tracking-widest mb-1`}>Email Found</span><div className="flex items-center gap-2 w-full justify-center"><span className={`text-sm font-mono font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'} px-3 py-1.5 bg-violet-600/10 rounded-lg break-all`}>{singleResult.email}</span><button onClick={() => copyToClipboard(singleResult.email!)} className="p-1.5 hover:bg-violet-600/10 rounded-md text-violet-600"><Copy className="w-4 h-4" /></button></div></div>}
                                                            {singleResult.linkedinUrl && <div className="flex flex-col items-center w-full"><span className={`text-[9px] font-bold ${themeClasses.label} uppercase tracking-widest mb-1`}>LinkedIn Profile</span><div className="flex items-center gap-2 w-full justify-center"><a href={singleResult.linkedinUrl} target="_blank" rel="noreferrer" className={`text-sm font-mono font-bold text-blue-500 hover:underline px-3 py-1.5 bg-blue-500/10 rounded-lg flex items-center gap-1.5 break-all`}>View Profile <ExternalLink className="w-3.5 h-3.5" /></a><button onClick={() => copyToClipboard(singleResult.linkedinUrl!)} className="p-1.5 hover:bg-blue-600/10 rounded-md text-blue-500"><Copy className="w-4 h-4" /></button></div></div>}
                                                        </div>
                                                        <div className="mt-2 flex flex-col items-center">
                                                            <span className={`text-[9px] font-bold ${themeClasses.label} uppercase tracking-widest mb-1`}>Status</span>
                                                            <div className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`inline-flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-[0.1em] px-3 py-1 rounded-full border shadow-sm min-w-[120px] ${singleResult.status === 'completed' || singleResult.status === 'deliverable' || singleResult.status === 'found' ? 'text-green-700 bg-green-100 border-green-200' : (singleResult.status === 'undeliverable' || singleResult.status === 'failed' ? 'text-rose-700 bg-rose-100 border-rose-200' : 'text-amber-700 bg-amber-100 border-amber-200')}`}>{singleResult.status === 'deliverable' ? 'VALID' : (singleResult.status === 'undeliverable' ? 'INVALID' : (singleResult.status || 'FAILED'))}</div>
                                                                    {(singleResult.status === 'failed' || singleResult.status === 'undeliverable' || singleResult.status === 'not_found') && (
                                                                        <button
                                                                            onClick={handleSingleRetry}
                                                                            disabled={isProcessing}
                                                                            className={`p-1.5 rounded-lg transition-all ${theme === 'dark' ? 'bg-violet-900/40 hover:bg-violet-900/60 text-violet-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'} disabled:opacity-50`}
                                                                            title="Retry fresh API call"
                                                                        >
                                                                            <RotateCw className={cn("w-3.5 h-3.5", isProcessing && "animate-spin")} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {singleResult.metadata?.cached && (
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        <div className={`inline-flex items-center justify-center gap-1 text-[7px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${theme === 'dark' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-violet-50 text-violet-600 border-violet-200'}`}>
                                                                            Already Processed
                                                                        </div>
                                                                        {singleResult.metadata?.synced && (
                                                                            <div className={`inline-flex items-center justify-center gap-1 text-[7px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border transition-all ${theme === 'dark' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                                                                Synced
                                                                            </div>
                                                                        )}
                                                                        {singleResult.cachedAt && (
                                                                            <span className={`text-[8px] font-medium opacity-60 ${theme === 'dark' ? 'text-violet-300' : 'text-slate-500'}`}>
                                                                                Ran on {new Date(singleResult.cachedAt).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} {singleResult.cachedType ? `via ${singleResult.cachedType === 'bulk' ? 'Bulk Upload' : 'Single Try'}` : ''}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {appMode === 'enrich' && !isHistoryView && (
                                                            <button
                                                                onClick={handleSingleApiExport}
                                                                className={`mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${theme === 'dark' ? 'bg-blue-900/20 border-blue-800/40 text-blue-400 hover:bg-blue-900/40' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'}`}
                                                            >
                                                                <Webhook className="w-3 h-3" /> Sync to API
                                                            </button>
                                                        )}
                                                    </motion.div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
                        <div className="lg:col-span-1 space-y-6">
                            <div className={`${themeClasses.card} p-6 rounded-3xl`}>
                                <div className="flex items-center justify-between mb-4"><h3 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}><FileSpreadsheet className="w-4 h-4 text-violet-600" /> Mapping</h3><button onClick={() => { setFile(null); setRows([]); }} className="text-[10px] text-rose-500 hover:underline font-bold">Discard</button></div>
                                <div className={`p-2 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-violet-200' : 'bg-black/5 border-black/10 text-slate-700'} rounded-lg border text-[10px] font-medium truncate mb-4`}>{file.name}</div>
                                <div className="space-y-4">
                                    {appMode === 'enrich' || appMode === 'linkedin' ? (
                                        <>
                                            <div><label className={`block text-[9px] font-bold ${themeClasses.label} uppercase tracking-widest mb-1 ml-1`}>{appMode === 'linkedin' ? 'FULLNAME' : 'Full Name Column'}</label><select className={`w-full p-2 ${themeClasses.input} rounded-lg text-xs font-medium focus:ring-2 focus:ring-violet-500 outline-none transition-all appearance-none cursor-pointer`} value={mapping?.nameHeader || ''} onChange={(e) => { const val = e.target.value; setMapping(prev => ({ ...prev!, nameHeader: val })); setRows(prevRows => prevRows.map(r => ({ ...r, name: String(r.originalData[val] || '').trim() }))); }} disabled={isProcessing}><option value="">Select Column</option>{headers.map(h => <option key={h} value={h} className={theme === 'dark' ? "bg-[#0f0720]" : "bg-white"}>{h}</option>)}</select></div>
                                            <div><label className={`block text-[9px] font-bold ${themeClasses.label} uppercase tracking-widest mb-1 ml-1`}>{appMode === 'linkedin' ? 'COMPANY NAME' : 'Company/Domain Column'}</label><select className={`w-full p-2 ${themeClasses.input} rounded-lg text-xs font-medium focus:ring-2 focus:ring-violet-500 outline-none transition-all appearance-none cursor-pointer`} value={mapping?.companyHeader || ''} onChange={(e) => { const val = e.target.value; setMapping(prev => ({ ...prev!, companyHeader: val })); setRows(prevRows => prevRows.map(r => ({ ...r, company: String(r.originalData[val] || '').trim() }))); }} disabled={isProcessing}><option value="">Select Column</option>{headers.map(h => <option key={h} value={h} className={theme === 'dark' ? "bg-[#0f0720]" : "bg-white"}>{h}</option>)}</select></div>
                                        </>
                                    ) : (
                                        <div><label className={`block text-[9px] font-bold ${themeClasses.label} uppercase tracking-widest mb-1 ml-1`}>Email Column to Verify</label><select className={`w-full p-2 ${themeClasses.input} rounded-lg text-xs font-medium focus:ring-2 focus:ring-violet-500 outline-none transition-all appearance-none cursor-pointer`} value={mapping?.emailHeader || ''} onChange={(e) => { const val = e.target.value; setMapping(prev => ({ ...prev!, emailHeader: val })); setRows(prevRows => prevRows.map(r => ({ ...r, email: String(r.originalData[val] || '').trim() }))); }} disabled={isProcessing}><option value="">Select Column</option>{headers.map(h => <option key={h} value={h} className={theme === 'dark' ? "bg-[#0f0720]" : "bg-white"}>{h}</option>)}</select></div>
                                    )}
                                    <button onClick={startProcessing} disabled={isProcessing || !mapping} className="w-full py-2.5 mt-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:text-white/80 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-xl text-xs">{isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : (appMode === 'enrich' ? <Mail className="w-4 h-4" /> : appMode === 'linkedin' ? <Linkedin className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />)}{isProcessing ? 'Processing...' : (appMode === 'enrich' ? 'Run Enrichment' : appMode === 'linkedin' ? 'Find Profiles' : 'Run Verification')}</button>
                                </div>
                            </div>
                            <div className={`${themeClasses.card} p-6 rounded-3xl`}>
                                <h3 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'} mb-2 flex items-center gap-2`}><BarChart2 className="w-4 h-4 text-emerald-500" /> Analytics</h3>
                                {stats.length > 0 ? (
                                    <div className="h-40 mt-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">{stats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />)}</Pie><Tooltip contentStyle={{ fontSize: '12px', fontWeight: 'bold', backgroundColor: theme === 'dark' ? '#1e1b4b' : '#fff', border: theme === 'dark' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid #e2e8f0', borderRadius: '10px', color: theme === 'dark' ? '#fff' : '#000' }} itemStyle={{ color: theme === 'dark' ? '#fff' : '#000' }} labelStyle={{ color: theme === 'dark' ? '#fff' : '#000' }} /><Legend iconSize={8} wrapperStyle={{ fontSize: '9px' }} /></PieChart></ResponsiveContainer></div>
                                ) : <div className={`text-center py-10 ${theme === 'dark' ? 'text-violet-400/30' : 'text-slate-400'} text-[9px] font-bold uppercase tracking-widest`}>Awaiting Data</div>}
                                {rows.some(r => r.status !== 'pending' && r.status !== 'processing') && (
                                    <div className="flex flex-col gap-2 mt-4">
                                        <button onClick={() => setShowExportModal(true)} className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-all font-bold text-[10px] shadow-lg"><Download className="w-3 h-3" /> Export</button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="lg:col-span-3">
                            <div className={`${themeClasses.card} rounded-3xl overflow-hidden flex flex-col h-[calc(100vh-10rem)]`}>
                                <div className={`px-8 py-6 border-b ${theme === 'dark' ? 'border-white/10' : 'border-black/5'} flex justify-between items-center`}>
                                    <div className="flex flex-col">
                                        <h4 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{appMode === 'enrich' ? 'Enrichment Feed' : appMode === 'linkedin' ? 'LinkedIn Profiles' : 'Verification Feed'}</h4>
                                        <span className={`text-[10px] font-bold ${themeClasses.label} uppercase tracking-widest`}>{rows.length} Total Records</span>
                                    </div>
                                    {rows.some(r => r.status !== 'pending' && r.status !== 'processing') && (
                                        <div className="flex items-center gap-3">
                                            {rows.some(r => r.status === 'failed' || r.status === 'undeliverable' || r.status === 'not_found') && (
                                                <button
                                                    onClick={handleRetryFailed}
                                                    disabled={isProcessing}
                                                    className="px-5 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-500 transition-all font-bold text-xs shadow-lg flex items-center gap-2 disabled:opacity-50"
                                                >
                                                    <RotateCw className={cn("w-4 h-4", isProcessing && "animate-spin")} /> Retry Failed Results
                                                </button>
                                            )}
                                            {isHistoryView && appMode === 'enrich' && (
                                                <button
                                                    onClick={handleGetApiResults}
                                                    className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-all font-bold text-xs shadow-lg flex items-center gap-2"
                                                >
                                                    <Webhook className="w-4 h-4" /> Get API Results
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 overflow-auto custom-scrollbar px-4">
                                    <table className="w-full text-left border-separate border-spacing-y-2">
                                        <thead className="sticky top-0 z-20">
                                            <tr>
                                                {(appMode === 'enrich' || appMode === 'linkedin') && <th className={`px-6 py-3 text-[10px] font-bold ${themeClasses.label} uppercase tracking-[0.2em] ${themeClasses.tableHeader} first:rounded-l-2xl sticky top-0 z-20`}>Contact</th>}
                                                {appMode !== 'linkedin' && <th className={`px-6 py-3 text-[10px] font-bold ${themeClasses.label} uppercase tracking-[0.2em] ${themeClasses.tableHeader} sticky top-0 z-20`}>Email</th>}
                                                {appMode === 'linkedin' && <th className={`px-6 py-3 text-[10px] font-bold ${themeClasses.label} uppercase tracking-[0.2em] ${themeClasses.tableHeader} sticky top-0 z-20`}>LinkedIn Profile</th>}
                                                <th className={`px-6 py-3 text-[10px] font-bold ${themeClasses.label} uppercase tracking-[0.2em] ${themeClasses.tableHeader} last:rounded-r-2xl sticky top-0 z-20 text-center`}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="px-4">
                                            {rows.map((row) => (
                                                <tr key={row.id} className={`group ${themeClasses.tableRow} transition-all`}>
                                                    {(appMode === 'enrich' || appMode === 'linkedin') && <td className={`px-6 py-3 first:rounded-l-2xl ${themeClasses.tableCell} transition-colors`}><div className="flex flex-col"><span className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}><User className="w-3.5 h-3.5 text-violet-600" />{row.name || row.originalData[mapping?.nameHeader || ''] || '—'}</span><span className={`text-[11px] font-medium ${theme === 'dark' ? 'text-violet-400/60' : 'text-slate-500'} flex items-center gap-2 mt-1`}><Building2 className="w-3 h-3" />{row.company || row.originalData[mapping?.companyHeader || ''] || '—'}</span></div></td>}
                                                    {appMode !== 'linkedin' && (
                                                        <td className={`px-6 py-3 ${themeClasses.tableCell} transition-colors`}>{row.email ? <div className="flex items-center gap-3"><span className={`text-sm font-mono ${theme === 'dark' ? 'text-violet-100 bg-white/5' : 'text-slate-700 bg-black/5'} px-3 py-1.5 rounded-lg border ${theme === 'dark' ? 'border-white/10' : 'border-black/10'} break-all`}>{row.email}</span><button onClick={() => copyToClipboard(row.email!)} className={`p-1.5 ${theme === 'dark' ? 'hover:bg-violet-500/20 text-violet-400' : 'hover:bg-amber-200 text-slate-500'} rounded-md transition-all hover:text-violet-600`}><Copy className="w-4 h-4" /></button></div> : <span className={`text-[11px] font-bold ${themeClasses.statusPending} uppercase tracking-widest italic`}>Ready</span>}</td>
                                                    )}
                                                    {appMode === 'linkedin' && (
                                                        <td className={`px-6 py-3 ${themeClasses.tableCell} transition-colors`}>{row.linkedinUrl ? <div className="flex items-center gap-3"><a href={row.linkedinUrl} target="_blank" rel="noreferrer" className={`text-sm font-mono text-blue-500 hover:underline flex items-center gap-1.5 break-all`}><Linkedin className="w-3.5 h-3.5" /> Profile</a><button onClick={() => copyToClipboard(row.linkedinUrl!)} className={`p-1.5 ${theme === 'dark' ? 'hover:bg-violet-500/20 text-violet-400' : 'hover:bg-amber-200 text-slate-500'} rounded-md transition-all`}><Copy className="w-4 h-4" /></button></div> : <span className={`text-[11px] font-bold ${themeClasses.statusPending} uppercase tracking-widest italic`}>Ready</span>}</td>
                                                    )}
                                                    <td className={`px-6 py-3 last:rounded-r-2xl ${themeClasses.tableCell} transition-colors text-center`}>
                                                        <div className="flex flex-col items-center gap-1">
                                                            <div className={`inline-flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border shadow-sm transition-all duration-300 min-w-[120px] ${row.status === 'processing' || row.status === 'searching' ? 'text-violet-600 bg-violet-100 border-violet-200 animate-pulse' : row.status === 'completed' || row.status === 'deliverable' || row.status === 'found' ? 'text-green-700 bg-green-100 border-green-200' : row.status === 'not_found' || row.status === 'risky' ? 'text-amber-700 bg-amber-100 border-amber-200' : row.status === 'failed' || row.status === 'undeliverable' ? 'text-rose-700 bg-rose-100 border-rose-200' : row.status === 'unknown' ? 'text-slate-600 bg-slate-100 border-slate-200' : themeClasses.statusPending}`}>{(row.status === 'processing' || row.status === 'searching') && <Loader2 className="w-3 h-3 animate-spin" />}{row.status === 'deliverable' ? 'VALID' : (row.status === 'undeliverable' ? 'INVALID' : row.status)}</div>
                                                            {row.metadata?.cached && (
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <div className={`inline-flex items-center justify-center gap-1 text-[7px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${theme === 'dark' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-violet-50 text-violet-600 border-violet-200'}`}>
                                                                        Already Processed
                                                                    </div>
                                                                    {(row.synced || row.metadata?.synced) && (
                                                                        <div className={`inline-flex items-center justify-center gap-1 text-[7px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border transition-all ${theme === 'dark' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>
                                                                            Synced
                                                                        </div>
                                                                    )}
                                                                    {row.cachedAt && (
                                                                        <span className={`text-[8px] font-medium opacity-60 ${theme === 'dark' ? 'text-violet-300' : 'text-slate-500'}`}>
                                                                            Ran on {new Date(row.cachedAt).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}  {row.cachedType ? `via ${row.cachedType === 'bulk' ? 'Bulk Upload' : 'Single Try'}` : ''}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {error && <div className="mt-8 p-5 glass-dark border-rose-500/30 rounded-2xl flex items-start gap-4 text-rose-500 animate-fade-in shadow-2xl bg-rose-50/10 backdrop-blur-md"><AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" /><div><p className="font-bold text-sm uppercase tracking-widest">Protocol Exception</p><p className="text-xs font-medium opacity-80 mt-1">{error}</p></div></div>}
            </main>
        </div >
    );
};

export default App;