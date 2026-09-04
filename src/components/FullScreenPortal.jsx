import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

export function FullScreenPortal({ children, onClose }) {
  // Acessibilidade: Fecha o modal ao pressionar a tecla ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return createPortal(
    <div 
      role="dialog" 
      aria-modal="true" 
      aria-label="Visualização de Dados em Tela Cheia"
      className="fixed inset-0 z-[99999] bg-[#080808] flex flex-col animate-fade-in backdrop-blur-sm"
    >
      {children}
    </div>,
    document.body
  )
}