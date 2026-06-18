import { useEffect, useState } from 'react'
import { uploadQueue, type QueueItem } from '@/lib/uploadQueue'

export function useUploadQueue(conversationId: string) {
  const [items, setItems] = useState<QueueItem[]>([])
  useEffect(() => {
    const unsub = uploadQueue.subscribe((all) =>
      setItems(all.filter((i) => i.conversationId === conversationId)),
    )
    return () => {
      unsub()
    }
  }, [conversationId])
  return items
}
