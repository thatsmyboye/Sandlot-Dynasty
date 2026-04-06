export type Position = "C" | "B1" | "B2" | "B3" | "SS" | "LF" | "CF" | "RF" | "SP" | "RP" | "CL";
export type Handedness = "L" | "R" | "S";
export type DevStage = "PROSPECT" | "RISING" | "PRIME" | "DECLINING" | "TWILIGHT";

export type GeneratedPlayer = {
  firstName: string;
  lastName: string;
  position: Position;
  birthYear: number;
  bats: Handedness;
  throws: Handedness;
  potential: number;
  contact: number;
  power: number;
  eye: number;
  speed: number;
  velocity: number;
  movement: number;
  control: number;
  stamina: number;
  glove: number;
  arm: number;
  clutch: number;
  durability: number;
  coachability: number;
  developmentStage: DevStage;
  isProspect: boolean;
  salary: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Name pools
// ---------------------------------------------------------------------------

const FIRST_ANGLO = [
  "Jake", "Tyler", "Cole", "Marcus", "Derek", "Ethan", "Logan", "Cody",
  "Ryan", "Brad", "Kyle", "Tanner", "Hunter", "Austin", "Blake", "Chase",
  "Garrett", "Preston", "Travis", "Connor", "Dylan", "Trevor", "Spencer",
  "Dillon", "Brock", "Weston", "Reid", "Shane", "Colby", "Lane",
];

const FIRST_HISPANIC = [
  "Carlos", "Miguel", "Jose", "Roberto", "Luis", "Juan", "Rafael", "Diego",
  "Alejandro", "Fernando", "Andres", "Ricardo", "Eduardo", "Manuel",
  "Santiago", "Victor", "Hector", "Marco", "Javier", "Ernesto",
];

const FIRST_ASIAN = [
  "Yuki", "Hiroshi", "Kenji", "Daisuke", "Shohei", "Hyun", "Jin", "Soo",
  "Wei", "Ming",
];

const FIRST_BLACK = [
  "Darius", "Marquis", "Jamal", "DeShawn", "Tyrone", "Kendrick", "Malcolm",
  "Jerome", "Antoine", "Terrell", "Lamar", "Darnell", "Andre", "Tremaine",
  "Quincy",
];

const LAST_ANGLO = [
  "Williams", "Johnson", "Davis", "Miller", "Wilson", "Moore", "Taylor",
  "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson",
  "Garcia", "Martinez", "Robinson", "Clark", "Rodriguez", "Lewis", "Lee",
  "Walker", "Hall", "Allen", "Young", "Hernandez", "King", "Wright", "Lopez",
  "Hill", "Scott", "Green", "Adams", "Baker", "Gonzalez", "Nelson", "Carter",
  "Mitchell", "Perez", "Roberts",
];

const LAST_HISPANIC = [
  "Ramirez", "Torres", "Flores", "Rivera", "Gomez", "Diaz", "Reyes", "Cruz",
  "Morales", "Ortiz", "Gutierrez", "Chavez", "Ramos", "Mendoza", "Castillo",
  "Vargas", "Jimenez", "Moreno", "Romero", "Herrera",
];

const LAST_ASIAN = [
  "Tanaka", "Suzuki", "Yamamoto", "Nakamura", "Watanabe", "Kim", "Park",
  "Lee", "Chen", "Huang",
];

const LAST_BLACK = [
  "Washington", "Jefferson", "Freeman", "Booker", "Coleman", "Crawford",
  "Cunningham", "Barton", "Chamberlain", "Holloway", "Holt", "Paige",
  "Saunders", "Strickland", "Underwood",
];

type Ethnicity = "anglo" | "hispanic" | "asian" | "black";

function pickEthnicity(): Ethnicity {
  const roll = Math.random();
  if (roll < 0.45) return "anglo";
  if (roll < 0.80) return "hispanic";
  if (roll < 0.90) return "asian";
  return "black";
}

function generateName(): { firstName: string; lastName: string } {
  const ethnicity = pickEthnicity();
  switch (ethnicity) {
    case "anglo":
      return { firstName: pickRandom(FIRST_ANGLO), lastName: pickRandom(LAST_ANGLO) };
    case "hispanic":
      return { firstName: pickRandom(FIRST_HISPANIC), lastName: pickRandom(LAST_HISPANIC) };
    case "asian":
      return { firstName: pickRandom(FIRST_ASIAN), lastName: pickRandom(LAST_ASIAN) };
    case "black":
      return { firstName: pickRandom(FIRST_BLACK), lastName: pickRandom(LAST_BLACK) };
  }
}

// ---------------------------------------------------------------------------
// Rating helpers
// ---------------------------------------------------------------------------

function isPitcher(position: Position): boolean {
  return position === "SP" || position === "RP" || position === "CL";
}

function devStageForAge(age: number): DevStage {
  if (age <= 22) return "PROSPECT";
  if (age <= 26) return "RISING";
  if (age <= 30) return "PRIME";
  if (age <= 34) return "DECLINING";
  return "TWILIGHT";
}

function applyAgeCurve(potential: number, age: number): number {
  if (age >= 27 && age <= 30) {
    // At peak — ratings can reach potential; add a bit of variance
    const variance = randInt(-5, 0);
    return clamp(potential + variance, 1, 100);
  } else if (age >= 18 && age <= 26) {
    // Young — 60–85% of potential
    const pct = 0.60 + Math.random() * 0.25;
    return clamp(Math.round(potential * pct), 1, 100);
  } else if (age >= 31 && age <= 34) {
    // Declining — drop 1–3 per year past 30
    const dropPerYear = randInt(1, 3);
    const drop = dropPerYear * (age - 30);
    return clamp(potential - drop, 1, 100);
  } else {
    // Twilight (35+) — more aggressive decline
    const baseDrop = randInt(3, 5) * (age - 30);
    return clamp(potential - baseDrop, 1, 100);
  }
}

function ratingInRange(base: number, min: number, max: number): number {
  return clamp(base, min, max);
}

// ---------------------------------------------------------------------------
// Handedness
// ---------------------------------------------------------------------------

function generateHandedness(isPitcherRole: boolean): { bats: Handedness; throws: Handedness } {
  const throwRoll = Math.random();
  const throws: Handedness = isPitcherRole
    ? throwRoll < 0.85 ? "R" : "L"
    : throwRoll < 0.70 ? "R" : throwRoll < 0.90 ? "L" : "S";

  const batRoll = Math.random();
  const bats: Handedness = isPitcherRole
    ? throwRoll < 0.85 ? "R" : "L"
    : batRoll < 0.70 ? "R" : batRoll < 0.90 ? "L" : "S";

  return { bats, throws };
}

// ---------------------------------------------------------------------------
// Salary calculation
// ---------------------------------------------------------------------------

function calculateSalary(
  devStage: DevStage,
  isProspect: boolean,
  position: Position,
  contact: number,
  power: number,
  eye: number,
  speed: number,
  velocity: number,
  movement: number,
  control: number,
  stamina: number,
): number {
  if (isProspect || devStage === "PROSPECT") {
    return 720;
  }

  const avgRating = isPitcher(position)
    ? (velocity + movement + control + stamina) / 4
    : (contact + power + eye + speed) / 4;

  let salary: number;

  switch (devStage) {
    case "RISING":
      salary = 800 + (avgRating - 50) * 80;
      break;
    case "PRIME":
      salary = 2000 + (avgRating - 50) * 400;
      break;
    case "DECLINING":
      salary = 1500 + (avgRating - 45) * 200;
      break;
    case "TWILIGHT":
      salary = 720 + (avgRating - 40) * 100;
      break;
    default:
      salary = 720;
  }

  return clamp(Math.round(salary), 720, 40000);
}

// ---------------------------------------------------------------------------
// Core generator
// ---------------------------------------------------------------------------

export function generatePlayer(
  currentYear: number,
  role: "starter" | "bench" | "sp" | "rp" | "cl" | "prospect",
  positionOverride?: Position,
): GeneratedPlayer {
  // Determine age range by role
  let ageMin: number;
  let ageMax: number;
  switch (role) {
    case "starter":
      ageMin = 24; ageMax = 34; break;
    case "bench":
      ageMin = 26; ageMax = 37; break;
    case "sp":
      ageMin = 24; ageMax = 35; break;
    case "rp":
      ageMin = 24; ageMax = 36; break;
    case "cl":
      ageMin = 26; ageMax = 35; break;
    case "prospect":
      ageMin = 18; ageMax = 22; break;
  }

  const age = randInt(ageMin, ageMax);
  const birthYear = currentYear - age;
  const devStage = devStageForAge(age);
  const isProspect = devStage === "PROSPECT";

  // Determine position
  let position: Position;
  if (positionOverride) {
    position = positionOverride;
  } else if (role === "sp") {
    position = "SP";
  } else if (role === "rp") {
    position = "RP";
  } else if (role === "cl") {
    position = "CL";
  } else {
    const fieldPositions: Position[] = ["C", "B1", "B2", "B3", "SS", "LF", "CF", "RF"];
    position = pickRandom(fieldPositions);
  }

  const pitcherRole = isPitcher(position);

  // Generate potential
  const potential = isProspect
    ? randInt(55, 95)
    : randInt(40, 85);

  // Generate ratings via age curve, then clamp to position-specific ranges
  const rawRating = (min: number, max: number): number =>
    ratingInRange(applyAgeCurve(potential, age), min, max);

  // Hitting
  let contact = rawRating(40, 90);
  let power = rawRating(30, 85);
  let eye = rawRating(35, 80);
  let speed = rawRating(30, 80);

  // Pitching
  let velocity = rawRating(45, 92);
  let movement = rawRating(40, 88);
  let control = rawRating(38, 85);
  let stamina = rawRating(50, 90);

  // Fielding
  let glove = rawRating(35, 85);
  let arm = rawRating(40, 85);

  // Intangibles
  const clutch = rawRating(30, 90);
  const durability = rawRating(40, 95);
  const coachability = rawRating(30, 90);

  // Position-specific overrides
  if (position === "C") {
    arm = ratingInRange(rawRating(60, 90), 60, 90);
    glove = ratingInRange(rawRating(55, 85), 55, 85);
  }
  if (position === "SS") {
    glove = ratingInRange(rawRating(60, 88), 60, 88);
    speed = ratingInRange(rawRating(55, 80), 55, 80);
  }
  if (position === "CF") {
    speed = ratingInRange(rawRating(60, 85), 60, 85);
    glove = ratingInRange(rawRating(58, 85), 58, 85);
  }
  if (position === "CL") {
    velocity = ratingInRange(rawRating(70, 95), 70, 95);
  }

  // Closers get high clutch
  const finalClutch = position === "CL"
    ? ratingInRange(rawRating(65, 90), 65, 90)
    : clutch;

  const { bats, throws } = generateHandedness(pitcherRole);

  const salary = calculateSalary(
    devStage,
    isProspect,
    position,
    contact,
    power,
    eye,
    speed,
    velocity,
    movement,
    control,
    stamina,
  );

  const { firstName, lastName } = generateName();

  return {
    firstName,
    lastName,
    position,
    birthYear,
    bats,
    throws,
    potential,
    contact,
    power,
    eye,
    speed,
    velocity,
    movement,
    control,
    stamina,
    glove,
    arm,
    clutch: finalClutch,
    durability,
    coachability,
    developmentStage: devStage,
    isProspect,
    salary,
  };
}

// ---------------------------------------------------------------------------
// Roster generator
// ---------------------------------------------------------------------------

export function generateRoster(currentYear: number): GeneratedPlayer[] {
  const players: GeneratedPlayer[] = [];

  // Starting position players (8)
  const startingPositions: Position[] = ["C", "B1", "B2", "B3", "SS", "LF", "CF", "RF"];
  for (const pos of startingPositions) {
    players.push(generatePlayer(currentYear, "starter", pos));
  }

  // Bench (5): 1 C, 2 IF, 2 OF
  players.push(generatePlayer(currentYear, "bench", "C"));

  const ifPositions: Position[] = ["B1", "B2", "B3", "SS"];
  players.push(generatePlayer(currentYear, "bench", pickRandom(ifPositions)));
  players.push(generatePlayer(currentYear, "bench", pickRandom(ifPositions)));

  const ofPositions: Position[] = ["LF", "CF", "RF"];
  players.push(generatePlayer(currentYear, "bench", pickRandom(ofPositions)));
  players.push(generatePlayer(currentYear, "bench", pickRandom(ofPositions)));

  // Pitching staff (9)
  for (let i = 0; i < 5; i++) {
    players.push(generatePlayer(currentYear, "sp", "SP"));
  }
  for (let i = 0; i < 3; i++) {
    players.push(generatePlayer(currentYear, "rp", "RP"));
  }
  players.push(generatePlayer(currentYear, "cl", "CL"));

  // Prospects (10): 8 position, 2 SP
  const prospectPositions: Position[] = ["C", "B1", "B2", "B3", "SS", "LF", "CF", "RF"];
  for (let i = 0; i < 8; i++) {
    players.push(generatePlayer(currentYear, "prospect", pickRandom(prospectPositions)));
  }
  for (let i = 0; i < 2; i++) {
    players.push(generatePlayer(currentYear, "prospect", "SP"));
  }

  return players;
}

// ---------------------------------------------------------------------------
// Free agent pool generator
// ---------------------------------------------------------------------------

export function generateFreeAgentPool(currentYear: number, count: number): GeneratedPlayer[] {
  const roles: Array<"starter" | "bench" | "sp" | "rp" | "cl"> = [
    "starter", "bench", "sp", "rp", "cl",
  ];
  const players: GeneratedPlayer[] = [];

  for (let i = 0; i < count; i++) {
    const role = pickRandom(roles);

    // Free agents skew older (28–38); override age after generation via birthYear
    const age = randInt(28, 38);
    const player = generatePlayer(currentYear, role);

    // Rebuild with adjusted birthYear and re-derived devStage/salary
    const devStage = devStageForAge(age);
    const isProspect = false;
    const salary = calculateSalary(
      devStage,
      isProspect,
      player.position,
      player.contact,
      player.power,
      player.eye,
      player.speed,
      player.velocity,
      player.movement,
      player.control,
      player.stamina,
    );

    players.push({
      ...player,
      birthYear: currentYear - age,
      developmentStage: devStage,
      isProspect,
      salary,
    });
  }

  return players;
}
