"use client"

import { useEffect, useRef, useCallback } from "react"
import { App } from "@capacitor/app"
import { useRouter, usePathname } from "next/navigation"

interface UseAndroidBackOptions {
  onBackPress?: () => void
  isHomePage?: boolean
}

export function useAndroidBack(options: UseAndroidBackOptions = {}) {
  const { onBackPress, isHomePage = false } = options
  const router = useRouter()
  const pathname = usePathname() // Use this to track location changes
  const backPressedOnceRef = useRef(false)
  const backPressTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Memoize the handler to prevent unnecessary listener resets
  const handleBackPress = useCallback(async () => {
    if (isHomePage || pathname === "/") {
      if (backPressedOnceRef.current) {
        App.exitApp()
      } else {
        backPressedOnceRef.current = true
        onBackPress?.()

        if (backPressTimerRef.current) clearTimeout(backPressTimerRef.current)
        
        backPressTimerRef.current = setTimeout(() => {
          backPressedOnceRef.current = false
        }, 2000)
      }
    } else {
      // Logic for sub-pages
      router.back()
    }
  }, [isHomePage, pathname, onBackPress, router])

  useEffect(() => {
    let isMounted = true

    const setupListener = async () => {
      const backListener = await App.addListener("backButton", () => {
        if (isMounted) handleBackPress()
      })
      
      return backListener
    }

    const listenerPromise = setupListener()

    return () => {
      isMounted = false
      listenerPromise.then(l => l.remove())
      if (backPressTimerRef.current) clearTimeout(backPressTimerRef.current)
    }
  }, [handleBackPress]) // Dependency on memoized handler
}