"use client";

import * as React from "react"
import { X } from "lucide-react"

const Dialog = ({ open, onOpenChange, children }: { open: boolean, onOpenChange: (open: boolean) => void, children: React.ReactNode }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => onOpenChange(false)}
            />
            {/* Content Container */}
            <div className="z-50 w-full max-w-lg p-6">
                {children}
            </div>
        </div>
    );
}

const DialogContent = ({ className, children }: { className?: string, children: React.ReactNode }) => {
    return (
        <div className={`relative w-full gap-4 border bg-background p-6 shadow-lg sm:rounded-lg ${className}`}>
            {children}
            {/* Close Button injected implicitly or handled by parent? 
           Radix usually has a Close button primitive. 
           Let's standardise on clicking backdrop to close for now, 
           or user adds a close button. 
           But to be nice, let's add an absolute close button. */}
        </div>
    )
}

const DialogHeader = ({ className, children }: { className?: string, children: React.ReactNode }) => (
    <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`}>
        {children}
    </div>
)

const DialogTitle = ({ className, children }: { className?: string, children: React.ReactNode }) => (
    <h2 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>
        {children}
    </h2>
)

const DialogDescription = ({ className, children }: { className?: string, children: React.ReactNode }) => (
    <p className={`text-sm text-muted-foreground ${className}`}>
        {children}
    </p>
)

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription }
