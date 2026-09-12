import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Brain, LayoutDashboard, PawPrint, Upload, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/pacientes", label: "Pacientes", icon: PawPrint },
  { to: "/importar", label: "Importar", icon: Upload },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { session, loading, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-sage text-sage-foreground">
              <Brain className="size-5" />
            </span>
            <span className="text-base font-semibold tracking-tight">NeuroVet Casos</span>
          </Link>
          <nav className="ml-auto flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeOptions={{ exact: l.to === "/" }}
                className="rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
                activeProps={{ className: "bg-sage text-sage-foreground" }}
              >
                <l.icon className="mr-1.5 inline size-4" />
                {l.label}
              </Link>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="ml-1 rounded-full text-muted-foreground"
              onClick={() => signOut()}
              title={isAdmin ? "Administrador" : "Usuário"}
            >
              <LogOut className="size-4" />
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
