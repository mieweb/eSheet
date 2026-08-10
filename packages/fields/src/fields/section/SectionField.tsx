import React from 'react';
import * as LucideIcons from 'lucide-react';
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
  user: LucideIcons.User,
  users: LucideIcons.Users,
  userPlus: LucideIcons.UserPlus,
  userMinus: LucideIcons.UserMinus,
  userCheck: LucideIcons.UserCheck,
  circleUser: LucideIcons.CircleUser,
  logIn: LucideIcons.LogIn,
  logOut: LucideIcons.LogOut,
  file: LucideIcons.File,
  fileText: LucideIcons.FileText,
  folder: LucideIcons.Folder,
  folderOpen: LucideIcons.FolderOpen,
  image: LucideIcons.Image,
  camera: LucideIcons.Camera,
  paperclip: LucideIcons.Paperclip,
  calendar: LucideIcons.Calendar,
  calendarClock: LucideIcons.CalendarClock,
  timer: LucideIcons.Timer,
  history: LucideIcons.History,
  grid: LucideIcons.Grid,
  list: LucideIcons.List,
  table: LucideIcons.Table,
  columns: LucideIcons.Columns,
  maximize: LucideIcons.Maximize,
  minimize: LucideIcons.Minimize,
  eye: LucideIcons.Eye,
  eyeOff: LucideIcons.EyeOff,
  search: LucideIcons.Search,
  shield: LucideIcons.Shield,
  shieldCheck: LucideIcons.ShieldCheck,
  shieldPlus: LucideIcons.ShieldPlus,
  lock: LucideIcons.Lock,
  unlock: LucideIcons.Unlock,
  key: LucideIcons.Key,
  hospital: LucideIcons.Hospital,
  ambulance: LucideIcons.Ambulance,
  stethoscope: LucideIcons.Stethoscope,
  briefcaseMedical: LucideIcons.BriefcaseMedical,
  heartPulse: LucideIcons.HeartPulse,
  activity: LucideIcons.Activity,
  pill: LucideIcons.Pill,
  tablets: LucideIcons.Tablets,
  syringe: LucideIcons.Syringe,
  testTube: LucideIcons.TestTube,
  testTubes: LucideIcons.TestTubes,
  flaskConical: LucideIcons.FlaskConical,
  microscope: LucideIcons.Microscope,
  dna: LucideIcons.Dna,
  brain: LucideIcons.Brain,
  bone: LucideIcons.Bone,
  bandage: LucideIcons.Bandage,
  thermometer: LucideIcons.Thermometer,
  droplet: LucideIcons.Droplet,
  droplets: LucideIcons.Droplets,
  bed: LucideIcons.Bed,
  bedDouble: LucideIcons.BedDouble,
  baby: LucideIcons.Baby,
  accessibility: LucideIcons.Accessibility,
  ear: LucideIcons.Ear,
  glasses: LucideIcons.Glasses,
  scan: LucideIcons.Scan,
  scanEye: LucideIcons.ScanEye,
  radiation: LucideIcons.Radiation,
  biohazard: LucideIcons.Biohazard,
  weight: LucideIcons.Weight,
  ruler: LucideIcons.Ruler,
  clipboard: LucideIcons.Clipboard,
  clipboardPlus: LucideIcons.ClipboardPlus,
  clipboardCheck: LucideIcons.ClipboardCheck,
  fileHeart: LucideIcons.FileHeart,
  filePlus: LucideIcons.FilePlus,
  fileCheck: LucideIcons.FileCheck,
  heart: LucideIcons.Heart,
  star: LucideIcons.Star,
  bookmark: LucideIcons.Bookmark,
  flag: LucideIcons.Flag,
  tag: LucideIcons.Tag,
  hash: LucideIcons.Hash,
  atSign: LucideIcons.AtSign,
  link: LucideIcons.Link,
  clipboardList: LucideIcons.ClipboardList,
  mapPin: LucideIcons.MapPin,
  globe: LucideIcons.Globe,
  building: LucideIcons.Building,
  briefcase: LucideIcons.Briefcase,
  creditCard: LucideIcons.CreditCard,
  dollarSign: LucideIcons.DollarSign,
  zap: LucideIcons.Zap,
  sparkles: LucideIcons.Sparkles,
  info: LucideIcons.Info,
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
  const sectionCollapse = def.sectionCollapse ?? 'disabled';
  const collapsible = sectionCollapse !== 'disabled';
  const defaultExpanded = collapsible ? sectionCollapse === 'expanded' : true;
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const [prevDefault, setPrevDefault] = React.useState(defaultExpanded);
  const SectionIcon = def.sectionIcon
    ? SECTION_ICONS[def.sectionIcon]
    : undefined;
  // Re-sync when collapse settings change while mounted (e.g. edited in builder).
  if (prevDefault !== defaultExpanded) {
    setPrevDefault(defaultExpanded);
    setExpanded(defaultExpanded);
  }
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
