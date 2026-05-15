import { Link } from "@tanstack/react-router";

interface Props {
  title: string;
  back?: string;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, back = "/home", right }: Props) {
  return (
    <header className="container-app pt-5 flex items-center gap-3">
      <Link to={back} className="bmx-tap -ml-2 p-2 text-foreground" aria-label="Volver">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Link>
      <h1 className="text-base font-semibold flex-1">{title}</h1>
      {right}
    </header>
  );
}
