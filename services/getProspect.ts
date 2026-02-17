
import { GetProspectResult, VerificationResult } from '../types';

const GETPROSPECT_API_KEY = '7a8ed0c6-ef4a-4b02-ab15-3d6fc1e4243d';
const BASE_URL = 'https://api.getprospect.com/public/v1/email';

export async function findEmail(name: string, company: string): Promise<GetProspectResult> {
  try {
    const params = new URLSearchParams({
      name: name.trim(),
      company: company.trim()
    });

    const response = await fetch(`${BASE_URL}/find?${params.toString()}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'apiKey': GETPROSPECT_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, message: `API Error: ${response.status} ${errorText}` };
    }

    const data = await response.json();

    if (data && data.email) {
      return { success: true, email: data.email };
    }

    return { success: false, message: 'No email found' };
  } catch (error: any) {
    console.error("GetProspect API Call Error:", error);
    return { success: false, message: error.message || 'Network error' };
  }
}

export async function verifyEmail(email: string): Promise<VerificationResult> {
  try {
    const params = new URLSearchParams({
      email: email.trim()
    });

    const response = await fetch(`${BASE_URL}/verify?${params.toString()}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'apiKey': GETPROSPECT_API_KEY
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, message: `API Error: ${response.status} ${errorText}` };
    }

    const data = await response.json();

    // GetProspect Verify returns a status field like 'deliverable', 'undeliverable', etc.
    if (data && data.status) {
      return {
        success: true,
        status: data.status as 'deliverable' | 'undeliverable' | 'risky' | 'unknown',
        rawData: data
      };
    }

    return { success: false, message: 'Unknown verification status' };
  } catch (error: any) {
    console.error("GetProspect Verify API Error:", error);
    return { success: false, message: error.message || 'Network error' };
  }
}
