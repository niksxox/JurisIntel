// Unified API response helper.
// Every route wraps its response through demoResponse() so the frontend
// always receives { success, demoMode, data } — never raw arrays/objects,
// never empty bodies, never HTML, never undefined.

import { NextResponse } from 'next/server';

export function demoResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, demoMode: true, data },
    { status },
  );
}

/** For live-DB responses — same envelope but demoMode reflects actual state. */
export function apiResponse<T>(data: T, demoMode = false) {
  return NextResponse.json({
    success: true,
    demoMode,
    data,
  });
}
