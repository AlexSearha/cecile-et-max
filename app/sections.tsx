import Image from "next/image";
import { wedding } from "@/lib/config";
import { FloralCorner, FloralSprig } from "./florals";
import ContactForm from "./contact-form";

/** En-tête bordeaux fleuri + photo des mariés en arche. */
export function HeroWithPhoto({ subtitle }: { subtitle: string }) {
  return (
    <>
      <header className="hero hero-home">
        <FloralCorner className="left" />
        <FloralCorner className="right" />
        <div className="hero-content">
          <p className="kicker">Nous nous marions</p>
          <h1>{wedding.couple}</h1>
          <div className="divider" aria-hidden="true">
            ✿
          </div>
          <p className="date">{wedding.date}</p>
          <p className="meta">{subtitle}</p>
        </div>
      </header>

      <figure className="portrait">
        <div className="portrait-frame">
          <Image src={wedding.photo.src} alt={wedding.photo.alt} fill priority sizes="(max-width: 600px) 78vw, 380px" />
        </div>
        <FloralCorner className="portrait-flower left" />
        <FloralCorner className="portrait-flower right" />
      </figure>
    </>
  );
}

/** Formulaire « Une question ? » : les messages arrivent dans le back-office. */
export function ContactSection() {
  return (
    <section className="card" id="contact">
      <FloralSprig />
      <h2>Une question ?</h2>
      <p className="intro">Écrivez-nous ici, nous vous répondrons au plus vite.</p>
      <ContactForm />
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <FloralSprig />
      <p>{wedding.couple}</p>
    </footer>
  );
}
