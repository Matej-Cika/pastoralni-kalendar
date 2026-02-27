import { useState, useEffect } from 'react'
import { supabase, Event, EventType } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface EditEventModalProps {
  event: Event
  onClose: () => void
  onSuccess: () => void
}

const EVENT_TYPES: { value: EventType; label: string; color: string }[] = [
  { value: 'LITURGY_FEAST', label: 'Liturgy Feast', color: '#FF6B6B' },
  { value: 'SOLEMNITY', label: 'Solemnity', color: '#4ECDC4' },
  { value: 'MASS', label: 'Mass', color: '#45B7D1' },
  { value: 'DEVOTION', label: 'Devotion', color: '#96CEB4' },
  { value: 'MEETING', label: 'Meeting', color: '#FFEAA7' },
  { value: 'CONVERSATION', label: 'Conversation', color: '#DDA0DD' },
  { value: 'ADMINISTRATIVE', label: 'Administrative', color: '#98D8C8' },
  { value: 'PERSONAL', label: 'Personal', color: '#F7DC6F' },
]

export default function EditEventModal({ event, onClose, onSuccess }: EditEventModalProps) {
  const { user } = useAuth()
  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description || '')
  const [eventType, setEventType] = useState<EventType>(event.event_type)
  const [startDate, setStartDate] = useState(new Date(event.start_time).toISOString().slice(0, 16))
  const [endDate, setEndDate] = useState(new Date(event.end_time).toISOString().slice(0, 16))
  const [isPrivate, setIsPrivate] = useState(event.is_private)
  const [loading, setLoading] = useState(false)

  const selectedType = EVENT_TYPES.find((t) => t.value === eventType)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !title.trim()) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('events')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          start_time: startDate,
          end_time: endDate,
          event_type: eventType,
          color: selectedType?.color || event.color,
          is_private: isPrivate,
        })
        .eq('id', event.id)

      if (error) throw error
      onSuccess()
    } catch (error) {
      console.error('Error updating event:', error)
      alert('Failed to update event')
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
            <h2 className="text-3xl font-bold text-gray-900">Edit Event</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-2">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Event title"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">Start Time *</label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-2">End Time *</label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-2">Event Type *</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
                required
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {selectedType && (
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded"
                    style={{ backgroundColor: selectedType.color }}
                  ></div>
                  <span className="text-lg text-gray-600">Color preview</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-2">Description / Notes</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPrivate"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isPrivate" className="ml-3 text-lg text-gray-700">
                Private event
              </label>
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
                disabled={loading || !title.trim()}
                className="px-6 py-3 text-lg font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating...' : 'Update Event'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
