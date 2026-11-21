import { wedding } from "@/lib/config";
import RsvpFlow from "./rsvp-flow";
import { FloralCorner, FloralSprig } from "./florals";
import Image from "next/image";

export default function Home() {
  const { venue } = wedding;
  return (
    <main>
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
          <p className="meta">{wedding.time}</p>
        </div>
      </header>
      <figure className="portrait">
        <div className="portrait-frame">
          <Image
            src={wedding.photo.src}
            alt={wedding.photo.alt}
            fill
            priority
            sizes="(max-width: 600px) 78vw, 380px"
          />
        </div>
        <FloralCorner className="portrait-flower left" />
        <FloralCorner className="portrait-flower right" />
      </figure>
      <div className="page page-home">
        <section className="card venue">
          <FloralSprig />
          <p>
            Nous avons hâte de partager notre bonheur avec vous au
            <br />
            <a
              href={venue.website}
              target="_blank"
              rel="noopener noreferrer"
              className="venue-name"
            >
              {venue.name}
            </a>
          </p>
          <p>
            Merci de nous confirmer ou non votre venue, ainsi que celle de vos
            conjoint(e) et enfant(s) en cliquant sur <strong>PRESENCE</strong>,
            afin que l&apos;on puisse s&apos;organiser plus facilement.
          </p>
          <p>
            Le domaine possède un grand nombre de couchages, ainsi vous pourrez
            profiter de la soirée sans vous soucier du trajet retour, moyennant
            la somme de <strong>{wedding.sleepPrice} € par personne</strong>.
            <br />
            Merci de nous le faire savoir en confirmant votre réservation à
            l'étape <strong>DORMIR</strong>, afin que nous puissions réserver.
          </p>
          <p>
            Nous prévoyons également un brunch pour le lendemain.
            <br />
            Merci de bien vouloir nous préciser si vous y serez présent ou non
            en confirmant votre présence à l'étape <strong>BRUNCH</strong>.
          </p>
          <p>Merci pour votre aide.</p>
          <p className="venue-end">À très bientôt !</p>
          <p className="muted">{venue.address}</p>
          <div className="venue-links">
            <a
              href={venue.website}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              Découvrir le domaine
            </a>
            <a
              href={venue.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              Itinéraire
            </a>
          </div>
        </section>

        <section className="card" id="rsvp">
          <FloralSprig />
          <h2>Présence · Dormir · Brunch</h2>
          <p className="intro">
            Recherchez votre nom pour retrouver votre invitation et répondre
            pour vous, votre conjoint(e) et vos enfants.
          </p>
          <RsvpFlow sleepPrice={wedding.sleepPrice} contact={wedding.contact} />
        </section>

        <footer className="footer">
          <FloralSprig />
          <p>{wedding.couple}</p>
        </footer>
      </div>
    </main>
  );
}
