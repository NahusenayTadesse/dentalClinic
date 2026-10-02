import type { forms as en } from '../en/forms';

/** The paper forms in Amharic. Typed as the English, so a question cannot be left untranslated. */
export const forms: typeof en = {
	patient: 'ታካሚ',
	fileNo: 'የፋይል ቁጥር',
	dateOfBirth: 'የትውልድ ቀን',
	phone: 'ስልክ',
	date: 'ቀን',
	signature: 'ፊርማ',
	name: 'ስም',

	consent: {
		title: (type: string) => `የስምምነት ቅጽ — ${type}`,
		treatment: 'ሕክምና',
		clinician: 'ሐኪም',
		patientSigns: 'የታካሚው ፊርማ',
		guardianSigns: 'ለሕፃን ወይም መፈረም ለማይችል ታካሚ፦ የወላጅ ወይም የአሳዳጊ ስምና ፊርማ',
		relationship: 'ከታካሚው ጋር ያለው ዝምድና',
		witness: 'ምስክር፦ ስምና ፊርማ',
		clinicianSigns: 'ሐኪም፦ ስምና ፊርማ',
		types: {
			treatment: 'የጥርስ ሕክምና',
			surgical: 'ቀዶ ሕክምና ወይም ጥርስ ማውጣት',
			anaesthetic: 'የማደንዘዣ መርፌ ወይም ማስታገሻ',
			radiograph: 'የራጅ ምርመራ',
			photography: 'የሕክምና ፎቶግራፎች',
			dataSharing: 'መረጃ ማጋራት'
		}
	},

	history: {
		title: 'የጤና ታሪክ',
		intro:
			'የጥርስ ሐኪምዎ ስለ ጤናዎ ማወቅ ያስፈልገዋል፦ አንዳንድ በሽታዎችና መድኃኒቶች የጥርስ ሕክምና በደህንነት እንዴት እንደሚሰጥ ይቀይራሉ። እባክዎ ሁሉንም ጥያቄዎች ይመልሱ። የሚጽፉት በሚስጥር ይጠበቃል።',
		yes: 'አዎ',
		no: 'አይ',
		details: 'አዎ ከሆነ፣ እባክዎ ዝርዝሩን ይጻፉ',
		onRecord: 'በመዝገባችን ያለው — የተሳሳተ ካለ እባክዎ ያርሙ',
		allergies: 'አለርጂዎች',
		conditions: 'በሽታዎች',
		medications: 'የሚወስዷቸው መድኃኒቶች',
		none: 'ምንም አልተመዘገበም',
		otherMedicines: 'ሌሎች መድኃኒቶች፣ የባህል መድኃኒቶችንና የእፅዋት መድኃኒቶችን ጨምሮ',
		declaration: 'እነዚህን ጥያቄዎች በማውቀው መጠን በእውነት መልሻለሁ። ጤናዬ ወይም መድኃኒቶቼ ከተቀየሩ ለክሊኒኩ አሳውቃለሁ።',
		questions: {
			heart: 'የልብ በሽታ፣ የልብ ማጉረምረም ወይም ሰው ሰራሽ የልብ ቫልቭ አለዎት?',
			bloodPressure: 'ከፍተኛ የደም ግፊት አለዎት?',
			diabetes: 'የስኳር በሽታ አለዎት?',
			bleeding: 'ሲቆረጡ ደም ለረጅም ጊዜ ይፈስስዎታል ወይም የደም መርጋት ችግር አለዎት?',
			bloodThinners: 'ደም የሚያቀጥን መድኃኒት (ለምሳሌ ዋርፋሪን፣ አስፕሪን ወይም ክሎፒዶግሬል) ይወስዳሉ?',
			asthma: 'አስም ወይም ሌላ የሳንባ በሽታ አለዎት?',
			epilepsy: 'የሚጥል በሽታ አለዎት?',
			liver: 'ሄፓታይተስ፣ የወፍ በሽታ ወይም ሌላ የጉበት በሽታ አለዎት?',
			kidney: 'የኩላሊት በሽታ አለዎት?',
			immune: 'የበሽታ መከላከል አቅምን የሚያዳክም በሽታ ወይም መድኃኒት፣ ኤች አይ ቪን ጨምሮ፣ አለዎት?',
			tuberculosis: 'ቲቢ (የሳንባ ነቀርሳ) አሁን ወይም ከዚህ በፊት ነበረብዎት?',
			cancer: 'ካንሰር፣ በራስ ወይም በአንገት ላይ የጨረር ሕክምና፣ ወይም ኬሞቴራፒ ወስደዋል?',
			boneMedicine: 'ለአጥንት የሚሰጥ መድኃኒት (ለምሳሌ አሌንድሮኔት ወይም ዞሌድሮኒክ አሲድ) ይወስዳሉ?',
			steroids: 'ባለፈው ዓመት ውስጥ የስቴሮይድ ኪኒን ወይም መርፌ ወስደዋል?',
			allergy: 'ለማንኛውም መድኃኒት (ለምሳሌ ፔኒሲሊን)፣ ለላቴክስ ወይም ለማደንዘዣ አለርጂ አለዎት?',
			anaesthetic: 'በጥርስ መርፌ ወይም በማደንዘዣ መጥፎ ምላሽ ገጥሞዎት ያውቃል?',
			pregnant: 'ነፍሰ ጡር ነዎት ወይም ጡት እያጠቡ ነው?',
			hospital: 'ባለፉት ሁለት ዓመታት ሆስፒታል ተኝተዋል ወይም ቀዶ ሕክምና ተደርጎልዎታል?',
			tobacco: 'ሲጋራ ያጨሳሉ ወይም ጫት ይቅማሉ?',
			other: 'ልናውቀው የሚገባ ሌላ በሽታ ወይም የጤና ችግር አለዎት?'
		}
	}
};
