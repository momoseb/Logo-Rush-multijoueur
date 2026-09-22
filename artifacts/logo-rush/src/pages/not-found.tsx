import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <h2 className="text-2xl font-semibold">{t('notFound.title')}</h2>
      <p className="text-muted-foreground max-w-md">
        {t('notFound.description')}
      </p>
      <Link href="/">
        <Button size="lg" className="mt-4">
          {t('room.backHome')}
        </Button>
      </Link>
    </div>
  );
}
