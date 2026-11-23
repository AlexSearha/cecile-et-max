import { wedding } from "@/lib/config";
import RsvpFlow from "./rsvp-flow";
import { FloralSprig } from "./florals";
import { ContactSection, Footer, HeroWithPhoto } from "./sections";

export default function Home() {
  const { venue } = wedding;
  return (
    <main>
      <HeroWithPhoto subtitle={wedding.time} />

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
            Afin de nous aider à tout organiser, merci de nous faire part de votre réponse grâce au{" "}
            <a href="#rsvp">formulaire ci-dessous</a>. Il vous suffit de rechercher votre nom : vous pourrez alors
            répondre pour vous, ainsi que pour votre conjoint(e) et vos enfant(s), en trois petites étapes.
          </p>
          <ol className="steps-list">
            <li>
              <strong>Présence</strong>
              <span>Serez-vous des nôtres pour célébrer ce jour ?</span>
            </li>
            <li>
              <strong>Dormir</strong>
              <span>
                Le domaine dispose de nombreux couchages : profitez de la soirée sans vous soucier du trajet retour,
                moyennant une participation de <strong>{wedding.sleepPrice} € par personne</strong> (gratuit pour les
                enfants de 0 à 3 ans).
                <span className="room-info">
                  <span>Draps, serviettes et ménage inclus</span>
                  <span>Chambres disponibles à partir de {wedding.roomsFrom}</span>
                  <span>Les chambres ne ferment pas à clé</span>
                </span>
              </span>
            </li>
            <li>
              <strong>Brunch</strong>
              <span>Nous vous attendons le lendemain pour un brunch tous ensemble. Serez-vous présent(e) ?</span>
            </li>
          </ol>
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
          <h2>Présence · Dormir · Brunch</h2>
          <p className="intro">
            Recherchez votre nom pour retrouver votre invitation et répondre pour vous, votre conjoint(e) et vos
            enfants.
          </p>
          <RsvpFlow mode="full" sleepPrice={wedding.sleepPrice} contact={wedding.contact} />
        </section>

        <ContactSection />
        <Footer />
      </div>
    </main>
  );
}
