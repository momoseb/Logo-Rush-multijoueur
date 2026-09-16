import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <h2 className="text-2xl font-semibold">Page introuvable</h2>
      <p className="text-muted-foreground max-w-md">
        Le logo que vous cherchez n'existe pas ou la page a été déplacée.
      </p>
      <Link href="/">
        <Button size="lg" className="mt-4">
          Retour à l'accueil
        </Button>
      </Link>
    </div>
  );
}
