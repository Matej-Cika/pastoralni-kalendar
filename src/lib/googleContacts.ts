// Google Contacts API integration (read-only)
// Note: This requires the user to grant contacts.readonly scope during OAuth

export interface GoogleContact {
  resourceName: string
  names?: Array<{
    displayName?: string
    givenName?: string
    familyName?: string
  }>
  phoneNumbers?: Array<{
    value: string
    type?: string
  }>
}

export async function fetchGoogleContacts(accessToken: string): Promise<GoogleContact[]> {
  try {
    const response = await fetch(
      'https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers&pageSize=1000',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch contacts: ${response.statusText}`)
    }

    const data = await response.json()
    return data.connections || []
  } catch (error) {
    console.error('Error fetching Google contacts:', error)
    throw error
  }
}

export function getContactDisplayName(contact: GoogleContact): string {
  return contact.names?.[0]?.displayName || 
         `${contact.names?.[0]?.givenName || ''} ${contact.names?.[0]?.familyName || ''}`.trim() ||
         'Unknown Contact'
}

export function getContactPhoneNumber(contact: GoogleContact): string | null {
  return contact.phoneNumbers?.[0]?.value || null
}
