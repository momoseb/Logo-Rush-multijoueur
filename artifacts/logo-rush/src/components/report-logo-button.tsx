import { useState } from 'react';
import { Check, Flag } from 'lucide-react';
import { useReportLogo } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function ReportLogoButton({ logoId, className }: { logoId?: string; className?: string }) {
  const { toast } = useToast();
  const [reportedId, setReportedId] = useState<string | null>(null);
  const reportLogo = useReportLogo();

  if (!logoId) return null;
  const reported = reportedId === logoId;

  const handleReport = () => {
    if (reported || reportLogo.isPending) return;
    reportLogo.mutate(
      { data: { logoId, reason: 'unknown' } },
      {
        onSuccess: () => {
          setReportedId(logoId);
          toast({ description: 'Merci, ce logo a été signalé.' });
        },
        onError: () => {
          toast({ variant: 'destructive', description: "Impossible d'envoyer le signalement." });
        },
      },
    );
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleReport}
      disabled={reported || reportLogo.isPending}
      className={cn('text-muted-foreground hover:text-foreground', className)}
      data-testid="button-report-logo"
    >
      {reported ? <Check className="h-4 w-4" /> : <Flag className="h-4 w-4" />}
      {reported ? 'Signalé' : 'Logo méconnaissable ?'}
    </Button>
  );
}
