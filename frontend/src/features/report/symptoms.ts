import type { StaticImageData } from "next/image";

import babcairIcon from "../../../public/images/symptoms/babcair.png";
import batukIcon from "../../../public/images/symptoms/batuk.png";
import demamIcon from "../../../public/images/symptoms/demam.png";
import muntahIcon from "../../../public/images/symptoms/muntah.png";
import pilekIcon from "../../../public/images/symptoms/pilek.png";
import sesakIcon from "../../../public/images/symptoms/sesak.png";

export type SymptomCategory = "ISPA" | "Diare";

export const symptomCategoryIcons: Record<SymptomCategory, StaticImageData> = {
  ISPA: sesakIcon,
  Diare: babcairIcon,
};

interface Symptom {
  label: string;
  icon: StaticImageData;
}

export const symptoms: Record<SymptomCategory, Symptom[]> = {
  ISPA: [
    { label: "Batuk", icon: batukIcon },
    { label: "Demam", icon: demamIcon },
    { label: "Sesak", icon: sesakIcon },
    { label: "Pilek", icon: pilekIcon },
  ],
  Diare: [
    { label: "BAB Cair", icon: babcairIcon },
    { label: "Muntah", icon: muntahIcon },
    { label: "Demam", icon: demamIcon },
  ],
};
