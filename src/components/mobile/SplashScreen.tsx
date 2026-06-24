import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { Capacitor } from '@capacitor/core'

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const { settings } = useSiteSettings()
  const logoUrl = useSignedUrl(settings.site_logo || settings.logo_url, 'site-assets')
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onFinish, 500) // Delay for exit animation
    }, 2500)

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
          {/* Animated Background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.1, 0.2, 0.1]
              }}
              transition={{ duration: 5, repeat: Infinity }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary rounded-full blur-[120px]"
            />
          </div>

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 15, stiffness: 100 }}
            className="relative"
          >
            <motion.div
              animate={{
                rotateY: 360,
                scale: [1, 1.1, 1]
              }}
              transition={{
                rotateY: { duration: 3, repeat: Infinity, ease: "linear" },
                scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
              }}
              className="w-32 h-32 rounded-3xl bg-transparent border border-white/10 shadow-2xl flex items-center justify-center overflow-hidden"
            >
              {logoUrl ? (
                <img src={logoUrl as string} alt="Logo" className="w-20 h-20 object-contain" />
              ) : (
                <span className="text-4xl font-bold text-primary">A</span>
              )}
            </motion.div>

            {/* Logo Glow */}
            <div className="absolute inset-0 bg-primary/20 blur-2xl -z-10 rounded-full scale-150" />
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center"
          >
            <h1 className="text-3xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              ABIACONNECT
            </h1>
            <p className="text-muted-foreground text-sm font-medium tracking-widest uppercase mt-1 opacity-60">
              Connecting Abians Worldwide
            </p>
          </motion.div>

          <div className="absolute bottom-12">
            <div className="h-1 w-32 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "0%" }}
                transition={{ duration: 2.5, ease: "easeInOut" }}
                className="h-full w-full bg-gradient-to-r from-primary to-secondary"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
