// Gentown political mod core structures

const IDEOLOGY_TYPES = [
  "Democracy",
  "kommunism",
  "Monarch",
  "military diktatur",
  "Anarchi"
];

class Perk {
  constructor(name, effect, category, description = "") {
    this.name = name;
    this.effect = effect;
    this.category = category;
    this.description = description;
  }
}

class Ideology {
  constructor(name, description, perks = [], cons = []) {
    this.name = name;
    this.description = description;
    this.perks = perks;
    this.cons = cons;
  }
}

class Leader {
  constructor(name, title, age, popularity, personality, perks = []) {
    this.name = name;
    this.title = title;
    this.age = age;
    this.popularity = popularity;
    this.personality = personality;
    this.perks = perks;
  }
}

class Party {
  constructor(name, ideology, support, perks = [], isGovernment = false) {
    this.name = name;
    this.ideology = ideology;
    this.support = support;
    this.perks = perks;
    this.isGovernment = isGovernment;
  }
}

class Country {
  constructor(name, leader, ideology, stability, corruption, support, nextElection, parties = [], perks = [], stats = {}) {
    this.name = name;
    this.leader = leader;
    this.ideology = ideology;
    this.stability = stability;
    this.corruption = corruption;
    this.support = support;
    this.nextElection = nextElection;
    this.parties = parties;
    this.perks = perks;
    this.stats = stats;
  }
}

function createDefaultIdeologies() {
  return [
    new Ideology(
      "Demokrati",
      "Vald representativ stat med fria val.",
      [
        new Perk("Valfrihet", { stability: 5, support: 5 }, "ideologi", "Ökar stabilitet och folkstöd."),
        new Perk("Folkstyre", { production: 3 }, "ideologi", "Stärker produktion genom medborgaraktion.")
      ],
      [
        new Perk("Fragmentering", { revoltChance: 5 }, "negativ", "Splittring mellan flera partier kan öka oro.")
      ]
    ),
    new Ideology(
      "Kommunism",
      "Statlig kontroll över produktion och fördelning.",
      [
        new Perk("Jämlikhet", { stability: 4 }, "ideologi", "Ökar stabilitet genom jämn fördelning."),
        new Perk("Planekonomi", { research: 4 }, "ideologi", "Stärker forskning med planerade investeringar.")
      ],
      [
        new Perk("Byråkrati", { production: -2 }, "negativ", "Tung administration sänker produktionen.")
      ]
    ),
    new Ideology(
      "Monarki",
      "Arvsbaserad ledare och traditionell struktur.",
      [
        new Perk("Stabil tradition", { stability: 6 }, "ideologi", "Tradition minskar inre konflikter."),
        new Perk("Nationalism", { support: 3 }, "ideologi", "Stärker folkstöd genom nationell identitet.")
      ],
      [
        new Perk("Korruption", { corruption: 5 }, "negativ", "Makten kan bli mindre ansvarig.")
      ]
    ),
    new Ideology(
      "Militärdiktatur",
      "Militärt styrd stat med strikt ordning.",
      [
        new Perk("Militär disciplin", { stability: 5 }, "ideologi", "Hård kontroll ger hög stabilitet."),
        new Perk("Säkerhet", { support: 2 }, "ideologi", "Folk känner sig tryggare under ordning.")
      ],
      [
        new Perk("Frihetsinskränkning", { revoltChance: 4 }, "negativ", "Begränsningar ökar risken för uppror.")
      ]
    ),
    new Ideology(
      "Teknokrati",
      "Specialister styr baserat på expertis och vetenskap.",
      [
        new Perk("Innovation", { research: 6 }, "ideologi", "Forskning får stora bonusar."),
        new Perk("Effektivitet", { production: 4 }, "ideologi", "Produktivitet ökar med teknikfokus.")
      ],
      [
        new Perk("Elitism", { support: -2 }, "negativ", "Folk kan uppleva systemet som otillgängligt.")
      ]
    ),
    new Ideology(
      "Anarki",
      "Ingen etablerad centralmakt, kaos och frihet.",
      [
        new Perk("Frihet", { support: 3 }, "ideologi", "Individer känner större frihet.")
      ],
      [
        new Perk("Kaos", { stability: -8 }, "negativ", "Stabiliteten sjunker kraftigt utan centralstyrning.")
      ]
    )
  ];
}

function randomFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateRandomLeader() {
  const names = ["Erik Lund", "Anna Berg", "Oskar Nilsson", "Ida Johansson", "Mikael Andersson"];
  const titles = ["President", "Statsminister", "Kansler", "Generalsekreterare", "Ledare"];
  const personalities = ["Karismatisk", "Strateg", "Korrupt", "Ekonom", "Aggressiv", "Fredlig", "Visionär", "Manipulativ"];

  const name = randomFrom(names);
  const title = randomFrom(titles);
  const age = 35 + Math.floor(Math.random() * 35);
  const popularity = 40 + Math.floor(Math.random() * 41);
  const personality = randomFrom(personalities);
  const perk = new Perk(personality, { popularity: 5 }, "ledare", `Ledaregenskap: ${personality}`);

  return new Leader(name, title, age, popularity, personality, [perk]);
}

function generateParty(name, ideology, support, isGovernment = false) {
  const perkOptions = [
    new Perk("Utbildning", { education: 3 }, "parti", "Förbättrar utbildningsnivån."),
    new Perk("Miljö", { environment: 3 }, "parti", "Förbättrar miljö och hållbarhet."),
    new Perk("Industri", { production: 3 }, "parti", "Ökar industriproduktionen."),
    new Perk("Handel", { trade: 3 }, "parti", "Stärker handels- och exportsektorn."),
    new Perk("Korruption", { corruption: 4 }, "negativ", "Ökar risken för skandaler."),
    new Perk("Missnöje", { support: -3 }, "negativ", "Minskar stödet bland väljarna.")
  ];

  return new Party(name, ideology, support, [randomFrom(perkOptions)], isGovernment);
}

function normalizePartySupport(parties) {
  const total = parties.reduce((sum, party) => sum + party.support, 0);
  if (total === 0) {
    const equal = Math.round(100 / parties.length);
    return parties.map((party, index) => {
      party.support = index === 0 ? 100 - equal * (parties.length - 1) : equal;
      return party;
    });
  }

  return parties.map(party => {
    party.support = Math.round((party.support / total) * 100);
    return party;
  });
}

function createCountry(name) {
  const ideologies = createDefaultIdeologies();
  const countryIdeology = randomFrom(ideologies);
  const leader = generateRandomLeader();
  const partyNames = ["Nationella Fronten", "Arbetaralliansen", "Folkpartiet", "Frihetsunionen"];
  const parties = partyNames.map((partyName, index) => {
    const support = 15 + Math.floor(Math.random() * 25);
    const partyIdeology = randomFrom(ideologies);
    return generateParty(partyName, partyIdeology, support, index === 0);
  });

  normalizePartySupport(parties);

  return new Country(
    name,
    leader,
    countryIdeology,
    60,
    20,
    50,
    4,
    parties,
    [],
    { GDP: 100, unemployment: 8, research: 50 }
  );
}

function saveCountry(country) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(`gentown_country_${country.name}`, JSON.stringify(country));
}

function loadCountry(name) {
  if (typeof localStorage === "undefined") return null;
  const data = localStorage.getItem(`gentown_country_${name}`);
  if (!data) return null;

  const parsed = JSON.parse(data);
  const leader = new Leader(
    parsed.leader.name,
    parsed.leader.title,
    parsed.leader.age,
    parsed.leader.popularity,
    parsed.leader.personality,
    parsed.leader.perks.map(p => new Perk(p.name, p.effect, p.category, p.description))
  );

  const ideology = new Ideology(
    parsed.ideology.name,
    parsed.ideology.description,
    parsed.ideology.perks.map(p => new Perk(p.name, p.effect, p.category, p.description)),
    parsed.ideology.cons.map(p => new Perk(p.name, p.effect, p.category, p.description))
  );

  const parties = parsed.parties.map(p => new Party(
    p.name,
    new Ideology(p.ideology.name, p.ideology.description, p.ideology.perks.map(pp => new Perk(pp.name, pp.effect, pp.category, pp.description)), p.ideology.cons.map(pp => new Perk(pp.name, pp.effect, pp.category, pp.description))),
    p.support,
    p.perks.map(pp => new Perk(pp.name, pp.effect, pp.category, pp.description)),
    p.isGovernment
  ));

  return new Country(
    parsed.name,
    leader,
    ideology,
    parsed.stability,
    parsed.corruption,
    parsed.support,
    parsed.nextElection,
    parties,
    parsed.perks.map(p => new Perk(p.name, p.effect, p.category, p.description)),
    parsed.stats
  );
}

function getPartySupportBars(parties) {
  return parties.map(party => ({
    party: party.name,
    support: party.support,
    government: party.isGovernment
  }));
}

function randomPoliticsPanel(country) {
  return {
    header: "POLITIK",
    country: country.name,
    leader: {
      name: country.leader.name,
      title: country.leader.title,
      age: country.leader.age,
      popularity: country.leader.popularity,
      personality: country.leader.personality,
      perks: country.leader.perks
    },
    government: {
      ideology: country.ideology.name,
      stability: country.stability,
      corruption: country.corruption,
      support: country.support,
      nextElection: country.nextElection
    },
    parties: country.parties.map(party => ({
      name: party.name,
      ideology: party.ideology.name,
      support: party.support,
      perks: party.perks,
      government: party.isGovernment
    }))
  };
}

function createPerkTooltip(perk) {
  return `${perk.name}: ${perk.description}`;
}

function generateTooltipForParty(party) {
  return party.perks.map(createPerkTooltip).join("\n");
}

export {
  IDEOLOGY_TYPES,
  Perk,
  Ideology,
  Leader,
  Party,
  Country,
  createDefaultIdeologies,
  createCountry,
  saveCountry,
  loadCountry,
  normalizePartySupport,
  getPartySupportBars,
  randomPoliticsPanel,
  createPerkTooltip,
  generateTooltipForParty
};
