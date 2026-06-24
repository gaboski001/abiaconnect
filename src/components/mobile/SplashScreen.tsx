import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Capacitor } from '@capacitor/core'

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onFinish, 400)
    }, 2200)
    return () => clearTimeout(timer)
  }, [onFinish])

  if (!Capacitor.isNativePlatform()) return null

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center"
        >
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
          </div>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 20 }}
            className="relative"
          >
            <motion.div
              animate={{ rotateY: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="w-32 h-32 flex items-center justify-center bg-transparent"
            >
              <img
                src="/Logo.png"
                alt="Logo"
                className="w-24 h-24 object-contain"
                onError={(e) => e.currentTarget.src = '/email-logo.png'}
              />
            </motion.div>
            <div className="absolute inset-0 bg-primary/10 blur-3xl -z-10 rounded-full scale-150" />
          </motion.div>

          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-6 text-center"
          >
            <h1 className="text-2xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              ABIACONNECT
            </h1>
            <p className="text-[10px] text-muted-foreground font-bold tracking-[0.2em] uppercase mt-2 opacity-50">
              Connecting Abians Worldwide
            </p>
          </motion.div>

          <div className="absolute bottom-16 w-32">
            <div className="h-0.5 w-full bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "0%" }}
                transition={{ duration: 2.2, ease: "linear" }}
                className="h-full w-full bg-primary"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
