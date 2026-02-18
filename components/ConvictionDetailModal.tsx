import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import DeepDiveContent from "./DeepDiveContent";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface ConvictionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    symbol: string | null;
}

export default function ConvictionDetailModal({ isOpen, onClose, symbol }: ConvictionDetailModalProps) {
    if (!symbol) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl bg-gray-900 border-gray-800 text-white max-h-[90vh] overflow-y-auto p-0">
                <VisuallyHidden>
                    <DialogTitle>Deep Dive Analysis for {symbol}</DialogTitle>
                    <DialogDescription>Detailed technical and options flow analysis</DialogDescription>
                </VisuallyHidden>

                <div className="p-1">
                    <DeepDiveContent symbol={symbol} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
