import React from 'react';
import {
  Accessibility,
  Activity,
  Ambulance,
  AtSign,
  Baby,
  Bandage,
  Bed,
  BedDouble,
  Biohazard,
  Bone,
  Bookmark,
  Brain,
  Briefcase,
  BriefcaseMedical,
  Building,
  Calendar,
  CalendarClock,
  Camera,
  CircleUser,
  Clipboard,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  Columns,
  CreditCard,
  Dna,
  DollarSign,
  Droplet,
  Droplets,
  Ear,
  Eye,
  EyeOff,
  File,
  FileCheck,
  FileHeart,
  FilePlus,
  FileText,
  Flag,
  FlaskConical,
  Folder,
  FolderOpen,
  Glasses,
  Globe,
  Grid,
  Hash,
  Heart,
  HeartPulse,
  History,
  Hospital,
  Image,
  Info,
  Key,
  Link,
  List,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  Maximize,
  Microscope,
  Minimize,
  Paperclip,
  Pill,
  Radiation,
  Ruler,
  Scan,
  ScanEye,
  Search,
  Shield,
  ShieldCheck,
  ShieldPlus,
  Sparkles,
  Star,
  Stethoscope,
  Syringe,
  Table,
  Tablets,
  Tag,
  TestTube,
  TestTubes,
  Thermometer,
  Timer,
  Unlock,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Weight,
  Zap,
} from 'lucide-react';
import type {
  FieldComponentProps,
  SectionFieldDefinition,
  SectionIconName,
} from '@esheet/core';
import { MinusIcon, PlusIcon } from '../../icons.js';

type SectionFieldProps = FieldComponentProps & {
  nestedChildren?: React.ReactNode;
};

const SECTION_ICONS: Record<
  SectionIconName,
  React.ComponentType<{ className?: string }>
> = {
  user: User,
  users: Users,
  userPlus: UserPlus,
  userMinus: UserMinus,
  userCheck: UserCheck,
  circleUser: CircleUser,
  logIn: LogIn,
  logOut: LogOut,
  file: File,
  fileText: FileText,
  folder: Folder,
  folderOpen: FolderOpen,
  image: Image,
  camera: Camera,
  paperclip: Paperclip,
  calendar: Calendar,
  calendarClock: CalendarClock,
  timer: Timer,
  history: History,
  grid: Grid,
  list: List,
  table: Table,
  columns: Columns,
  maximize: Maximize,
  minimize: Minimize,
  eye: Eye,
  eyeOff: EyeOff,
  search: Search,
  shield: Shield,
  shieldCheck: ShieldCheck,
  shieldPlus: ShieldPlus,
  lock: Lock,
  unlock: Unlock,
  key: Key,
  hospital: Hospital,
  ambulance: Ambulance,
  stethoscope: Stethoscope,
  briefcaseMedical: BriefcaseMedical,
  heartPulse: HeartPulse,
  activity: Activity,
  pill: Pill,
  tablets: Tablets,
  syringe: Syringe,
  testTube: TestTube,
  testTubes: TestTubes,
  flaskConical: FlaskConical,
  microscope: Microscope,
  dna: Dna,
  brain: Brain,
  bone: Bone,
  bandage: Bandage,
  thermometer: Thermometer,
  droplet: Droplet,
  droplets: Droplets,
  bed: Bed,
  bedDouble: BedDouble,
  baby: Baby,
  accessibility: Accessibility,
  ear: Ear,
  glasses: Glasses,
  scan: Scan,
  scanEye: ScanEye,
  radiation: Radiation,
  biohazard: Biohazard,
  weight: Weight,
  ruler: Ruler,
  clipboard: Clipboard,
  clipboardPlus: ClipboardPlus,
  clipboardCheck: ClipboardCheck,
  fileHeart: FileHeart,
  filePlus: FilePlus,
  fileCheck: FileCheck,
  heart: Heart,
  star: Star,
  bookmark: Bookmark,
  flag: Flag,
  tag: Tag,
  hash: Hash,
  atSign: AtSign,
  link: Link,
  clipboardList: ClipboardList,
  mapPin: MapPin,
  globe: Globe,
  building: Building,
  briefcase: Briefcase,
  creditCard: CreditCard,
  dollarSign: DollarSign,
  zap: Zap,
  sparkles: Sparkles,
  info: Info,
};

/**
 * SectionField - Renders section header and empty state.
 * Canvas manages rendering nested children.
 */
export const SectionField = React.memo(function SectionField({
  field,
  form,
  isPreview,
  isRequired,
  isSoftRequired,
  onUpdate,
  nestedChildren,
}: SectionFieldProps) {
  const def = field.definition as SectionFieldDefinition;
  const instanceId = form.getState().instanceId;
  const title = def.title || 'Section';
  const bodyId = React.useId();
  const sectionCollapse = def.sectionCollapse as NonNullable<
    SectionFieldDefinition['sectionCollapse']
  >;
  const collapsible = sectionCollapse !== 'disabled';
  const defaultExpanded = collapsible ? sectionCollapse === 'expanded' : true;
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const SectionIcon = def.sectionIcon
    ? SECTION_ICONS[def.sectionIcon]
    : undefined;
  React.useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);
  const isExpanded = collapsible ? expanded : true;

  if (isPreview) {
    return (
      <section className="section-field-preview ms:overflow-hidden ms:rounded-lg ms:border ms:border-msborder ms:bg-mssurface">
        <h3 className="ms:m-0 ms:bg-msbackgroundsecondary ms:text-base ms:font-semibold ms:text-mstext ms:break-words ms:overflow-hidden">
          {collapsible ? (
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-controls={bodyId}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title}`}
              onClick={() => setExpanded((prev) => !prev)}
              className="ms:w-full ms:flex ms:items-center ms:justify-between ms:gap-3 ms:px-4 ms:py-3 ms:text-left ms:text-base ms:font-semibold ms:text-mstext ms:bg-transparent ms:border-0 ms:cursor-pointer"
            >
              <span className="ms:flex ms:min-w-0 ms:items-center ms:gap-2">
                {SectionIcon && (
                  <SectionIcon className="ms:h-5 ms:w-5 ms:shrink-0 ms:text-mstextmuted" />
                )}
                <span className="ms:min-w-0 ms:break-words">
                  {title}
                  {(isRequired || isSoftRequired) && (
                    <span className="ms:text-msdanger ms:ml-1">*</span>
                  )}
                </span>
              </span>
              {isExpanded ? (
                <MinusIcon className="ms:h-5 ms:w-5 ms:shrink-0 ms:text-mstextmuted" />
              ) : (
                <PlusIcon className="ms:h-5 ms:w-5 ms:shrink-0 ms:text-mstextmuted" />
              )}
            </button>
          ) : (
            <span className="ms:flex ms:items-center ms:gap-2 ms:px-4 ms:py-3">
              {SectionIcon && (
                <SectionIcon className="ms:h-5 ms:w-5 ms:shrink-0 ms:text-mstextmuted" />
              )}
              <span className="ms:break-words">
                {title}
                {(isRequired || isSoftRequired) && (
                  <span className="ms:text-msdanger ms:ml-1">*</span>
                )}
              </span>
            </span>
          )}
        </h3>
        {nestedChildren && isExpanded && (
          <div
            id={bodyId}
            className="ms:space-y-3 ms:border-t ms:border-msborder ms:bg-mssurface ms:px-4 ms:py-3"
          >
            {nestedChildren}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="section-field-edit ms:flex ms:flex-col ms:gap-3">
      <div className="section-field-header ms:flex ms:items-center ms:justify-between ms:gap-3 ms:rounded-lg ms:border ms:border-msborder ms:bg-msbackgroundsecondary ms:p-3">
        {SectionIcon && (
          <SectionIcon className="ms:h-5 ms:w-5 ms:shrink-0 ms:text-mstextmuted" />
        )}
        <div className="ms:flex-1">
          <label
            htmlFor={`${instanceId}-editor-section-title-${def.id}`}
            className="ms:block ms:text-sm ms:font-medium ms:text-mstextmuted ms:mb-1"
          >
            Section Title
          </label>
          <input
            id={`${instanceId}-editor-section-title-${def.id}`}
            aria-label="Section Title"
            className="ms:px-3 ms:py-2 ms:h-10 ms:w-full ms:min-w-0 ms:border ms:border-msborder ms:bg-mssurface ms:text-mstext ms:rounded-lg ms:focus:border-msprimary ms:focus:ring-1 ms:focus:ring-msprimary/30 ms:outline-none"
            type="text"
            value={def.title || ''}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Section title (e.g., Data Consent)"
          />
        </div>
      </div>

      <div className="section-edit-children ms:flex-1">{nestedChildren}</div>
    </div>
  );
});
