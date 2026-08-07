import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])

  const show = useCallback((message, type = 'success', duration = 3500) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const icons = { success: 'ti-circle-check', error: 'ti-circle-x', info: 'ti-info-circle', warning: 'ti-alert-triangle' }
  const classes = { success: 'toast-success', error: 'toast-error', info: 'toast-info', warning: 'toast-warning' }

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
        {toasts.map(t => (
          <div key={t.id} className={classes[t.type]}>
            <i className={`ti ${icons[t.type]} text-lg`}/>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
