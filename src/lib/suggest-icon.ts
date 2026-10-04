// Picks a sensible lucide icon for a subject from its name.
const RULES: [RegExp, string][] = [
  [/machine learning|artificial intelligence|\bai\b|neural|deep learning/i, "brain"],
  [/data ?base|dbms|sql/i, "database"],
  [/network|communication network|computer networks/i, "network"],
  [/operating system/i, "monitor"],
  [/data structure|algorithm/i, "git-branch"],
  [/program|coding|software|java|python|c\+\+|object oriented|compiler|web/i, "code-xml"],
  [/math|calculus|algebra|statistic|probability|discrete|graph theory|numerical|linear/i, "sigma"],
  [/physics|quantum|optics/i, "atom"],
  [/chemistry|chemical/i, "flask-conical"],
  [/biology|life science/i, "dna"],
  [/electronic|digital|vlsi|microprocessor|microcontroller|embedded/i, "cpu"],
  [/circuit|electrical|power system|machines|electric/i, "zap"],
  [/signal|wave|antenna|communication/i, "waves"],
  [/control system|instrument/i, "gauge"],
  [/thermo|heat|combustion/i, "flame"],
  [/fluid|hydraulic|water/i, "droplets"],
  [/mechanic|machine design|manufactur|production|automobile|kinematic/i, "cog"],
  [/graphics|drawing|drafting|design and engineering|cad/i, "pencil-ruler"],
  [/structur|concrete|construction|civil|surveying|geotech|transport/i, "building-2"],
  [/environment|sustainab|ecology|disaster/i, "leaf"],
  [/english|communication skills|language|professional communication/i, "book-open"],
  [/economics|management|entrepreneur|finance|accounting/i, "briefcase"],
  [/ethics|constitution|law|policy/i, "scale"],
  [/robot|automation/i, "bot"],
  [/security|cryptograph/i, "shield"],
  [/cloud|distributed|server/i, "server"],
  [/lab|workshop|practical/i, "flask-round"],
  [/project|seminar|internship/i, "lightbulb"],
];

export function suggestIcon(name: string) {
  return RULES.find(([re]) => re.test(name))?.[1] ?? "book-open";
}
