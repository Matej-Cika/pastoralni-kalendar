import { useState, useEffect } from 'react'
import { supabase, Event, Conversation } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface ConversationModalProps {
  event: Event | null
  onClose: () => void
  onSuccess: () => void
}

export default function ConversationModal({ event, onClose, onSuccess }: ConversationModalProps) {
  const { user } = useAuth()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [personName, setPersonName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [conversationType, setConversationType] = useState('')
  const [privateNotes, setPrivateNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const isNew = !event

  useEffect(() => {
    if (event) {
      fetchConversation()
    }
  }, [event])

  async function fetchConversation() {
    if (!event) return

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('event_id', event.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (data) {
        setConversation(data)
        setPersonName(data.person_name)
        setPhoneNumber(data.phone_number || '')
        setConversationType(data.conversation_type || '')
        setPrivateNotes(data.private_notes || '')
      }
    } catch (error) {
      console.error('Error fetching conversation:', error)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !personName.trim()) return

    setLoading(true)
    try {
      let eventId = event?.id

      if (!eventId) {
        const { data: newEvent, error: eventError } = await supabase
          .from('events')
          .insert({
            title: `Conversation: ${personName}`,
            description: privateNotes.trim() || null,
            start_time: new Date().toISOString(),
            end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            event_type: 'AKTIVNOST',
            color: '#10b981',
            is_private: true,
            created_by: user.id,
            is_deleted: false,
          })
          .select()
          .single()

        if (eventError) throw eventError
        eventId = newEvent.id
      }

      const conversationData = {
        event_id: eventId,
        person_name: personName.trim(),
        google_contact_id: null,
        phone_number: phoneNumber.trim() || null,
        conversation_type: conversationType.trim() || null,
        private_notes: privateNotes.trim() || null,
      }

      if (conversation) {
        const { error } = await supabase
          .from('conversations')
          .update(conversationData)
          .eq('id', conversation.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('conversations').insert(conversationData)

        if (error) throw error
      }

      onSuccess()
    } catch (error) {
      console.error('Error saving conversation:', error)
      alert('Failed to save conversation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-3xl font-bold text-gray-900">
              {isNew ? 'New Conversation' : 'Edit Conversation'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-2">Person Name *</label>
              <input
                type="text"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                required
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Name of the person"
              />
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-2">Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Phone number"
              />
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-2">Conversation Type</label>
              <input
                type="text"
                value={conversationType}
                onChange={(e) => setConversationType(e.target.value)}
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Pastoral care, Confession, Counseling"
              />
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-2">Private Notes</label>
              <textarea
                value={privateNotes}
                onChange={(e) => setPrivateNotes(e.target.value)}
                rows={6}
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Private notes about this conversation..."
              />
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 text-lg font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !personName.trim()}
                className="px-6 py-3 text-lg font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save Conversation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
