// Tout ce qui est personnalisable se trouve ici.
export const wedding = {
  couple: "Cécile & Maxime",
  date: "Samedi 20 Octobre 2027",
  time: "Cérémonie à 15h00",
  // Sous-titre de la page « cérémonie + vin d'honneur » (/vin-honneur)
  vinTime: "Cérémonie à 15h00, suivie du vin d'honneur",

  // Photo des mariés : déposez le fichier dans /public (format portrait conseillé, ex. 1200×1500)
  photo: {
    src: "/couple.jpg",
    alt: "Camille et Thomas",
  },

  venue: {
    name: "Domaine de la Butte Ronde",
    address:
      "Domaine de la Butte Ronde, La Butte Ronde, 78125 La Boissière-École",
    website: "https://www.domainedelabutteronde.fr/",
    mapsUrl:
      "https://www.google.com/maps/dir/?api=1&destination=Domaine+de+la+Butte+Ronde,+La+Boissi%C3%A8re-%C3%89cole+78125&travelmode=driving",
  },

  // Participation demandée par personne pour dormir sur place (en euros)
  sleepPrice: 50,
  // Heure à partir de laquelle les chambres sont disponibles
  roomsFrom: "16h30",

  // Contact affiché en complément du formulaire (laisser "" pour ne pas l'afficher)
  contact: "Posez votre question dans le formulaire prévu à cet effet",
};
