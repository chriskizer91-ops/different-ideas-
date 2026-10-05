// Icons from Lucide (ISC license), plus a pot drawn to match them.
import { createLucideIcon } from 'lucide-preact';

export {
  Carrot,
  Check,
  ChevronDown,
  Clock,
  CloudRain,
  Clover,
  Download,
  Droplets,
  Flower2,
  Leaf,
  LoaderCircle,
  MapPin,
  Navigation,
  Plus,
  RotateCw,
  Search,
  Shrub,
  Snowflake,
  Sprout,
  Sun,
  ThermometerSnowflake,
  ThermometerSun,
  Trash2,
  TreeDeciduous,
  Undo2,
  Upload,
  X,
} from 'lucide-preact';

import { Carrot, Clover, Flower2, Shrub, Sprout, TreeDeciduous, Leaf } from 'lucide-preact';

export const PotIcon = createLucideIcon('pot', [
  ['path', { d: 'M4 10a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z' }],
  ['path', { d: 'M5.5 12l1.3 7.6a1.7 1.7 0 0 0 1.7 1.4h7a1.7 1.7 0 0 0 1.7-1.4l1.3-7.6' }],
  ['path', { d: 'M12 9V5.5' }],
  ['path', { d: 'M12 6.5c0-2 1.3-3.5 3.5-3.5h.5v.5c0 2-1.3 3.5-3.5 3.5z' }],
  ['path', { d: 'M12 7.5c0-1.7-1.2-3-3.2-3h-.5V5c0 1.7 1.2 3 3.2 3z' }],
]);

const PLANT_ICONS = { veg: Carrot, flowers: Flower2, lawn: Clover, lawnWarm: Clover, shrubs: Shrub, trees: TreeDeciduous, natives: Leaf };
export const iconFor = (bed) => (bed.site === 'pot' ? PotIcon : PLANT_ICONS[bed.plant] || Sprout);
