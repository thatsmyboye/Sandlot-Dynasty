export type NarrativeContext = {
  batterName: string;      // "Martinez"
  pitcherName: string;     // "Chen"
  inning: number;
  isTop: boolean;
  outs: number;
  runnersOn: string;       // "000" | "100" | "010" | "001" | "110" | "101" | "011" | "111"
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function toOrdinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  if (n >= 4 && n <= 20) return `${n}th`;
  const lastDigit = n % 10;
  if (lastDigit === 1) return `${n}st`;
  if (lastDigit === 2) return `${n}nd`;
  if (lastDigit === 3) return `${n}rd`;
  return `${n}th`;
}

function fill(template: string, ctx: NarrativeContext): string {
  return template
    .replace(/\{batter\}/g, ctx.batterName)
    .replace(/\{pitcher\}/g, ctx.pitcherName)
    .replace(/\{pitcherName\}/g, ctx.pitcherName)
    .replace(/\{homeTeam\}/g, ctx.homeTeam)
    .replace(/\{awayTeam\}/g, ctx.awayTeam)
    .replace(/\{homeScore\}/g, String(ctx.homeScore))
    .replace(/\{awayScore\}/g, String(ctx.awayScore))
    .replace(/\{ordinal\}/g, toOrdinal(ctx.inning))
    .replace(/\{inning\}/g, String(ctx.inning))
    .replace(/\{outs\}/g, String(ctx.outs));
}

const templates: Record<string, string[]> = {
  SINGLE: [
    "{batter} works a full count before lacing a single to left field.",
    "{batter} rips a sharp grounder through the right side for a base hit.",
    "{batter} pokes one the other way — a soft single to right field.",
    "A seeing-eye grounder up the middle. {batter} beats the throw and is safe at first.",
    "{batter} gets the barrel on a fastball and slaps it into left-center for a single.",
    "{batter} chops one off the plate and hustles down the line — infield single.",
    "A blooper into shallow center. The outfielder charges but can't get there. Single, {batter}.",
  ],
  DOUBLE: [
    "{batter} crushes one into the left-center gap — he's around first and into second standing up.",
    "Down the line in left! The ball rolls to the corner and {batter} steams into second with a double.",
    "{batter} gets extended and drives a ball off the right-field wall. Two-bagger for {batter}.",
    "A scalded liner splits the outfielders in the gap. {batter} slides into second with a double.",
    "{batter} works the count and punishes a hanging breaking ball into the left-center alley. Double.",
    "Off the wall in right-center! {batter} never slows down — he's in with a double.",
    "A towering shot that hits the base of the wall. {batter} pulls up at second with a double.",
  ],
  TRIPLE: [
    "A rope down the right-field line! {batter} is flying around the bases — he'll try for three... safe with a triple!",
    "{batter} turns on one and hits a sizzler into the right-center gap. He's not stopping — triple!",
    "Deep drive to left-center, rattling around the corner! {batter} is legging it out — triple!",
    "The ball splits the outfielders and rolls all the way to the warning track. {batter} slides in safely — triple!",
    "An absolute rocket to the right-field corner! {batter} rounds second, rounds third — in with a triple!",
    "{batter} turns on a fastball and drills it past the diving right fielder. He'll score... no, held up at third with a triple!",
  ],
  HOME_RUN: [
    "{batter} gets all of that one. A towering shot to deep left — gone! Home run, {batter}!",
    "{batter} turns on a fastball and sends it into orbit. That ball is CRUSHED.",
    "High drive to deep right-center... it's back... it's GONE! {batter} with a home run!",
    "{batter} unloads on a hanging breaking ball and launches it into the second deck. Goodbye!",
    "A no-doubt shot from {batter}! He watched it the whole way. Home run!",
    "{batter} pulls a fastball and puts it into the left-field seats. See ya!",
    "Gone — and it wasn't even close. {batter} hammers one deep into right field. Home run!",
  ],
  WALK: [
    "{pitcherName} misses outside. Ball four. {batter} trots to first.",
    "A full-count walk. {pitcherName} couldn't find the strike zone and {batter} takes first.",
    "{pitcherName} goes to a full count... misses high. {batter} draws the walk.",
    "Four wide ones. {pitcherName} wasn't even close on that last pitch. {batter} takes his base.",
    "Ball four bounces in the dirt. {pitcherName} loses {batter} and falls behind this lineup.",
    "{pitcherName} misses for the fourth time — ball four. {batter} walks on four pitches.",
    "An intentional-looking walk. {pitcherName} wants nothing to do with {batter} right now.",
  ],
  STRIKEOUT: [
    "{pitcherName} blows a fastball past {batter} for the strikeout.",
    "{batter} chases a breaking ball in the dirt. Strike three, he's gone.",
    "Called strike three on the outside corner. {batter} didn't even flinch. He's out.",
    "{pitcherName} gets {batter} swinging on a nasty slider. Punchout.",
    "{batter} waves at a curveball in the dirt. Strikeout.",
    "{pitcherName} paints the black with a fastball. Strike three called. {batter} argues but he's out.",
    "A full count... {pitcherName} fires a changeup. {batter} is way out front — strike three!",
  ],
  GROUNDOUT: [
    "{batter} rolls one to short — routine throw to first, out by a step.",
    "A slow roller to third. The throw beats {batter} by plenty.",
    "{batter} pounds one into the dirt. A quick scoop by the shortstop and he's out.",
    "Soft chopper back to the mound. {pitcherName} fields it cleanly and throws to first. Retired.",
    "A hard grounder to second — the pivot and the throw. Out at first.",
    "{batter} gets jammed and rolls a weak one to the first baseman. No play needed.",
    "One hop to third, glove to first — {batter} is retired on a routine groundout.",
  ],
  FLYOUT: [
    "High fly ball to center. The outfielder settles under it — caught.",
    "{batter} gets under one and lifts it to right. Routine fly out.",
    "{batter} swings late and pops a can of corn to left field. Caught without a step.",
    "A lazy fly to shallow right. The second baseman drifts back — he's got it. Out.",
    "Long drive to center field... the outfielder is tracking it... makes the catch at the warning track.",
    "{batter} lofts a fly ball to left-center. Routine out.",
    "A towering pop-up behind home plate. The catcher circles under it — caught.",
  ],
  LINEOUT: [
    "{batter} stings a liner right at the shortstop. Caught for the out.",
    "Screaming line drive — but right at the second baseman. Out.",
    "{batter} absolutely destroys one — but right into the glove of the third baseman. Unlucky.",
    "A frozen rope to right field. The outfielder doesn't have to move an inch. Lineout.",
    "{batter} smokes it — but the first baseman snares it for the out.",
    "A sharp liner back to the mound. {pitcherName} spears it with a quick glove. Out.",
    "{batter} drives one into the gap — but the shortstop leaps and snags it. What a play.",
  ],
  STOLEN_BASE: [
    "{batter} breaks on the pitch — he's in easily! Stolen base.",
    "Running on the pitch, {batter} gets a great jump and slides in under the tag. Stolen base.",
    "{batter} takes off and {pitcherName} doesn't even look. Easy steal for {batter}.",
    "The count goes to two and two... {batter} is running! Throw's late — stolen base.",
    "{batter} swipes second with a headfirst slide. No contest — he had that one stolen.",
    "Green light on {batter}. He breaks and beats the throw by two steps. Stolen base.",
  ],
  CAUGHT_STEALING: [
    "{batter} attempts to steal but the throw beats him to the bag. Caught stealing.",
    "Running on the pitch — the throw is on time and accurate. {batter} is out. Caught stealing.",
    "{batter} gets a decent jump but the catcher guns him down at second.",
    "A pitchout! The catcher fires to second and {batter} is out by a mile. Caught stealing.",
    "{batter} breaks for second — perfect throw — he's tagged out. Caught stealing.",
    "{batter} gambles on the pitch but the catcher's arm wins. Out at second.",
  ],
  ERROR: [
    "A routine grounder... but it kicks off the fielder's glove! {batter} reaches on the error.",
    "The throw pulls the first baseman off the bag — safe! Error charged to the infield.",
    "{batter} hits a soft one to short — and it squirts right through! Error, and {batter} is aboard.",
    "An easy pop fly drops between two outfielders. Nobody called for it. Error on the play.",
    "The relay throw skips into the dugout. {batter} takes an extra base on the error.",
    "A wild throw sails into right field. {batter} trots to first on the fielding error.",
  ],
  PITCHING_CHANGE: [
    "The manager makes his way to the mound. Pitching change — {pitcherName} is now in from the bullpen.",
    "The umpire signals to the bullpen. {pitcherName} jogs in to take over.",
    "Time called on the field. A new arm is coming in — {pitcherName} will take the ball.",
    "The starter has had enough. {pitcherName} enters to face the next hitter.",
    "Out comes the manager, and here comes {pitcherName} from the pen.",
    "The hook is out. {pitcherName} strides in from the bullpen to stop the bleeding.",
  ],
  INNING_END: [
    "Three up, three down.",
    "That'll end the half-inning.",
    "Side retired.",
    "The inning is over. No damage done.",
    "And that's three outs. Teams switch sides.",
    "The half-inning comes to a close.",
    "No runs, and we change sides.",
  ],
  GAME_END: [
    "And that's the ballgame! Final: {awayTeam} {awayScore}, {homeTeam} {homeScore}.",
    "That'll do it! {awayTeam} {awayScore}, {homeTeam} {homeScore}. Final.",
    "The final out is recorded. Ballgame over — {awayTeam} {awayScore}, {homeTeam} {homeScore}.",
    "Game over! The final score: {awayTeam} {awayScore}, {homeTeam} {homeScore}.",
    "It's over! Final score — {awayTeam} {awayScore}, {homeTeam} {homeScore}.",
  ],
};

export function generateNarrative(eventType: string, ctx: NarrativeContext): string {
  // INNING_START is special — top vs bottom picks different subset
  if (eventType === "INNING_START") {
    const topTemplates = [
      "Top of the {ordinal} inning. {awayTeam} batting.",
      "We head to the top of the {ordinal}. {awayTeam} sends it up.",
      "Top of the {ordinal} — {awayTeam} looking to get something going.",
      "Now batting in the top of the {ordinal}, the {awayTeam}.",
      "The {awayTeam} come to bat in the top half of the {ordinal}.",
    ];
    const bottomTemplates = [
      "Bottom of the {ordinal} inning. {homeTeam} batting.",
      "The {homeTeam} come to bat in the bottom of the {ordinal}.",
      "Bottom half of the {ordinal} inning. {homeTeam} up.",
      "Home side coming up — bottom of the {ordinal}.",
      "Now batting in the bottom of the {ordinal}, the {homeTeam}.",
    ];
    const chosen = ctx.isTop ? pick(topTemplates) : pick(bottomTemplates);
    return fill(chosen, ctx);
  }

  const pool = templates[eventType];
  if (!pool || pool.length === 0) {
    return `${eventType} — ${ctx.batterName} vs ${ctx.pitcherName}.`;
  }

  return fill(pick(pool), ctx);
}
