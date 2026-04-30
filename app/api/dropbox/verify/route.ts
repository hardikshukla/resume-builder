import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token is required' }, { status: 400 });
    }

    // Verify token by fetching the current user's account
    const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({ valid: true, account: data.name?.display_name });
    } else {
      const errorText = await response.text();
      let errorMessage = 'Invalid token';
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error_summary) {
          errorMessage = errorJson.error_summary;
        }
      } catch (e) {
        // Fallback to text if not JSON
      }
      return NextResponse.json({ valid: false, error: errorMessage }, { status: 401 });
    }
  } catch (error) {
    console.error('Error verifying Dropbox token:', error);
    return NextResponse.json({ valid: false, error: 'Server error during verification' }, { status: 500 });
  }
}
