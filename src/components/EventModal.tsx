import { Event, toEventCategory } from '../lib/supabase'

const EVENT_TYPE_LABELS: Record<string, string> = {
  POBOZNOST: 'Pobožnost',
  AKTIVNOST: 'Aktivnost',
  SAKRAMENT: 'Sakrament',
}
import EditEventModal from './EditEventModal'
import { useState } from 'react'

interface EventModalProps {
  event: Event
  onClose: () => void
  onDelete: () => void
  onUpdate: () => void
  canDelete: boolean
  canEdit: boolean
}

export default function EventModal({ event, onClose, onDelete, onUpdate, canDelete, canEdit }: EventModalProps) {
  const [showEditModal, setShowEditModal] = useState(false)
  const startDate = new Date(event.start_time)
  const endDate = new Date(event.end_time)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl sm:text-3xl font-bold text-gray-900 break-words min-w-0">{event.title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-lg font-semibold text-gray-700 mb-1">Date & Time</div>
              <div className="text-lg text-gray-900">
                {startDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
              <div className="text-lg text-gray-900">
                {startDate.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}{' '}
                - {endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>

            <div>
              <div className="text-lg font-semibold text-gray-700 mb-1">Event Type</div>
              <div className="inline-block px-3 py-1 rounded text-lg" style={{ backgroundColor: event.color + '20', color: event.color }}>
                {EVENT_TYPE_LABELS[toEventCategory(event.event_type)] ?? event.event_type}
              </div>
            </div>

            {event.description && (
              <div>
                <div className="text-lg font-semibold text-gray-700 mb-1">Notes</div>
                <div className="text-lg text-gray-900 whitespace-pre-wrap">{event.description}</div>
              </div>
            )}

            {event.is_private && (
              <div className="text-sm text-gray-500 italic">Private event</div>
            )}
          </div>

          {(canDelete || canEdit) && (
            <div className="mt-6 pt-6 border-t flex gap-4">
              {canEdit && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="px-4 py-2 text-lg font-medium text-blue-600 hover:text-blue-700"
                >
                  Edit Event
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this event? It will be archived, not permanently deleted.')) {
                      onDelete()
                    }
                  }}
                  className="px-4 py-2 text-lg font-medium text-red-600 hover:text-red-700"
                >
                  Delete Event
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showEditModal && (
        <EditEventModal
          event={event}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false)
            onUpdate()
          }}
        />
      )}
    </div>
  )
}
