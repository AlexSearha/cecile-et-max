import type { Metadata } from "next";
import { wedding } from "@/lib/config";
import RsvpFlow from "../rsvp-flow";
import { FloralSprig } from "../florals";
import { ContactSection, Footer, HeroWithPhoto } from "../sections";

export const metadata: Metadata = {
  title: `Mariage ${wedding.couple} – Cérémonie et vin d'honneur`,
  robots: { index: false, follow: false },
};

/** Page pour les invités « cérémonie + vin d'honneur » uniquement (lien à leur envoyer : /vin-honneur). */
export default function VinHonneur() {
  const { venue } = wedding;
  return (
    <main>
      <HeroWithPhoto subtitle={wedding.vinTime} />

      <div className="page page-home">
        <section className="card venue">
          <FloralSprig />
          <p>
            Nous avons hâte de partager notre bonheur avec vous au
            <br />
            <a href={venue.website} target="_blank" rel="noopener noreferrer" className="venue-name">
              {venue.name}
            </a>
          </p>
          <p>
            Nous serions heureux de vous compter parmi nous pour la cérémonie, suivie du vin d&apos;honneur.
          </p>
          <p>
            Afin de nous aider à tout organiser, merci de nous indiquer si vous serez présent(e) grâce au{" "}
            <a href="#rsvp">formulaire ci-dessous</a>. Recherchez simplement votre nom : vous pourrez répondre pour vous,
            votre conjoint(e) et vos enfant(s).
          </p>
          <p>Merci pour votre aide.</p>
          <p className="venue-end">À très bientôt !</p>
          <p className="muted">{venue.address}</p>
          <div className="venue-links">
            <a href={venue.website} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              Découvrir le domaine
            </a>
            <a href={venue.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              Itinéraire
            </a>
            <a href="#rsvp" className="btn">
              Répondre
            </a>
          </div>
        </section>

        <section className="card" id="rsvp">
          <FloralSprig />
          <h2>Cérémonie · Vin d&apos;honneur</h2>
          <p className="intro">Recherchez votre nom pour retrouver votre invitation.</p>
          <RsvpFlow mode="vin" sleepPrice={wedding.sleepPrice} contact={wedding.contact} />
        </section>

        <ContactSection />
        <Footer />
      </div>
    </main>
  );
}
