import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { mockDemographics } from '@/lib/mockApiResponses';

function ageBucket(age: number): string {
  if (age <= 25) return '18-25';
  if (age <= 35) return '26-35';
  if (age <= 45) return '36-45';
  if (age <= 55) return '46-55';
  return '56+';
}

export async function GET() {
  if (DEMO_MODE) { return NextResponse.json(mockDemographics()); }
  try {
    const accused = await db.accused.findMany({
      select: { age: true, gender: true, occupation: true },
    });

    const ageBuckets = ['18-25', '26-35', '36-45', '46-55', '56+'];
    const ageMap = new Map<string, number>(ageBuckets.map((b) => [b, 0]));
    const genderMap = new Map<string, number>();
    const occupationMap = new Map<string, number>();

    for (const a of accused) {
      const b = ageBucket(a.age);
      ageMap.set(b, (ageMap.get(b) || 0) + 1);
      genderMap.set(a.gender, (genderMap.get(a.gender) || 0) + 1);
      if (a.occupation) occupationMap.set(a.occupation, (occupationMap.get(a.occupation) || 0) + 1);
    }

    return NextResponse.json({
      ageGroups: ageBuckets.map((range) => ({ range, count: ageMap.get(range) || 0 })),
      gender: Array.from(genderMap.entries())
        .map(([gender, count]) => ({ gender, count }))
        .sort((a, b) => b.count - a.count),
      occupation: Array.from(occupationMap.entries())
        .map(([occupation, count]) => ({ occupation, count }))
        .sort((a, b) => b.count - a.count),
    });
  } catch (err) {
    console.error('[socio/demographics]', err);
    return NextResponse.json(mockDemographics());
  }
}
