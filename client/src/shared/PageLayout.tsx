import { useEffect, useRef, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Heading, Text } from "@ds/components";

export function PageLayout({ title, description, actions, children, narrow = false }: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  narrow?: boolean;
}) {
  const { pathname } = useLocation();
  const content = useRef<HTMLElement>(null);
  useEffect(() => {
    document.title = title + " | NEXTHIRE";
  }, [title]);
  useEffect(() => { content.current?.focus(); }, [pathname]);

  return (
    <div className="nh-shell" dir="rtl">
      <a className="nh-skip-link" href="#main-content">דילוג לתוכן</a>
      <header className="nh-site-header">
        <div className="nh-site-header-inner">
          <NavLink to="/" end className="nh-brand" aria-label="NEXTHIRE — לדף הבית">
            <img className="nh-brand-logo" src="/nexthire-logo.png" alt="NEXTHIRE" width="2048" height="768" />
          </NavLink>
          <nav aria-label="ניווט ראשי" className="nh-navigation">
            <NavLink to="/" end>ראשי</NavLink>
            <NavLink to="/candidates">מועמדים</NavLink>
            <NavLink to="/applications">הגשות</NavLink>
          </nav>
        </div>
      </header>
      <main id="main-content" ref={content} tabIndex={-1} className={"nh-page" + (narrow ? " nh-page-narrow" : "")}>
        <header className="nh-page-header">
          <div className="nh-heading-group">
            <Heading level={1}>{title}</Heading>
            {description && <Text>{description}</Text>}
          </div>
          {actions && <div className="nh-actions">{actions}</div>}
        </header>
        <div className="nh-content">{children}</div>
      </main>
    </div>
  );
}

