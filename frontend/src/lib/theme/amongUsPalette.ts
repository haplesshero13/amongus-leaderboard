export const amongUsPalette = {
  ui: {
    menuCyan: '#75DBF4',
    darkBlue: '#235685',
    highlight: '#FFDE2A',
    warning: '#F21717',
    orange: '#EF7D0E',
    redDark: '#C51111',
    coral: '#EC7678',
  },
  chart: {
    overall: '#FFDE2A',
    overallOutline: '#235685',
    overallError: '#EF7D0E',
    impostor: '#F21717',
    impostorOutline: '#C51111',
    impostorError: '#C51111',
    crewmate: '#75DBF4',
    crewmateOutline: '#235685',
    crewmateError: '#235685',
  },
} as const;

export const leaderboardColorClasses = {
  overallCard: 'bg-[#FFDE2A]/18 dark:bg-[#FFDE2A]/12',
  overallValue: 'text-[#EF7D0E] dark:text-[#FFDE2A]',
  overallDetail: 'text-[#235685]/75 dark:text-[#FFDE2A]/80',
  impostorCard: 'bg-[#F21717]/10 dark:bg-[#F21717]/14',
  impostorValue: 'text-[#F21717] dark:text-[#EC7678]',
  impostorDetail: 'text-[#C51111]/75 dark:text-[#EC7678]/80',
  crewmateCard: 'bg-[#75DBF4]/18 dark:bg-[#75DBF4]/12',
  crewmateValue: 'text-[#235685] dark:text-[#75DBF4]',
  crewmateDetail: 'text-[#235685]/75 dark:text-[#75DBF4]/80',
  uiAccent: 'text-[#235685] dark:text-[#75DBF4]',
  uiActive: 'bg-[#235685] text-[#FFDE2A]',
} as const;
