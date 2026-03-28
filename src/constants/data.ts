export const INDIAN_STATES = [
  { value: 'andhra-pradesh', labelKey: 'states.andhraPradesh' },
  { value: 'arunachal-pradesh', labelKey: 'states.arunachalPradesh' },
  { value: 'assam', labelKey: 'states.assam' },
  { value: 'bihar', labelKey: 'states.bihar' },
  { value: 'chhattisgarh', labelKey: 'states.chhattisgarh' },
  { value: 'goa', labelKey: 'states.goa' },
  { value: 'gujarat', labelKey: 'states.gujarat' },
  { value: 'haryana', labelKey: 'states.haryana' },
  { value: 'himachal-pradesh', labelKey: 'states.himachalPradesh' },
  { value: 'jharkhand', labelKey: 'states.jharkhand' },
  { value: 'karnataka', labelKey: 'states.karnataka' },
  { value: 'kerala', labelKey: 'states.kerala' },
  { value: 'madhya-pradesh', labelKey: 'states.madhyaPradesh' },
  { value: 'maharashtra', labelKey: 'states.maharashtra' },
  { value: 'manipur', labelKey: 'states.manipur' },
  { value: 'meghalaya', labelKey: 'states.meghalaya' },
  { value: 'mizoram', labelKey: 'states.mizoram' },
  { value: 'nagaland', labelKey: 'states.nagaland' },
  { value: 'odisha', labelKey: 'states.odisha' },
  { value: 'punjab', labelKey: 'states.punjab' },
  { value: 'rajasthan', labelKey: 'states.rajasthan' },
  { value: 'sikkim', labelKey: 'states.sikkim' },
  { value: 'tamil-nadu', labelKey: 'states.tamilNadu' },
  { value: 'telangana', labelKey: 'states.telangana' },
  { value: 'tripura', labelKey: 'states.tripura' },
  { value: 'uttar-pradesh', labelKey: 'states.uttarPradesh' },
  { value: 'uttarakhand', labelKey: 'states.uttarakhand' },
  { value: 'west-bengal', labelKey: 'states.westBengal' },
];

export const FARMER_TYPES = [
  { value: 'small', labelKey: 'signUp.farmerTypes.small' },
  { value: 'medium', labelKey: 'signUp.farmerTypes.medium' },
  { value: 'large', labelKey: 'signUp.farmerTypes.large' },
];

export const LANGUAGES = [
  { value: 'en', labelKey: 'signUp.languages.en' },
  { value: 'bn', labelKey: 'signUp.languages.bn' },
  { value: 'hi', labelKey: 'signUp.languages.hi' },
];
// Common districts across major states
export const INDIAN_DISTRICTS = [
  // West Bengal
  { value: 'nadia', labelKey: 'districts.nadia' },
  { value: 'kolkata', labelKey: 'districts.kolkata' },
  { value: 'howrah', labelKey: 'districts.howrah' },
  { value: 'hooghly', labelKey: 'districts.hooghly' },
  { value: 'north-24-parganas', labelKey: 'districts.north24Parganas' },
  { value: 'south-24-parganas', labelKey: 'districts.south24Parganas' },
  { value: 'bardhaman', labelKey: 'districts.bardhaman' },
  { value: 'murshidabad', labelKey: 'districts.murshidabad' },
  { value: 'malda', labelKey: 'districts.malda' },
  { value: 'jalpaiguri', labelKey: 'districts.jalpaiguri' },
  { value: 'darjeeling', labelKey: 'districts.darjeeling' },
  { value: 'cooch-behar', labelKey: 'districts.coochBehar' },
  { value: 'bankura', labelKey: 'districts.bankura' },
  { value: 'purulia', labelKey: 'districts.purulia' },
  { value: 'birbhum', labelKey: 'districts.birbhum' },
  { value: 'midnapore', labelKey: 'districts.midnapore' },
  
  // Bihar
  { value: 'patna', labelKey: 'districts.patna' },
  { value: 'gaya', labelKey: 'districts.gaya' },
  { value: 'bhagalpur', labelKey: 'districts.bhagalpur' },
  { value: 'muzaffarpur', labelKey: 'districts.muzaffarpur' },
  { value: 'darbhanga', labelKey: 'districts.darbhanga' },
  
  // Uttar Pradesh
  { value: 'lucknow', labelKey: 'districts.lucknow' },
  { value: 'kanpur', labelKey: 'districts.kanpur' },
  { value: 'agra', labelKey: 'districts.agra' },
  { value: 'varanasi', labelKey: 'districts.varanasi' },
  { value: 'allahabad', labelKey: 'districts.allahabad' },
  { value: 'meerut', labelKey: 'districts.meerut' },
  
  // Maharashtra
  { value: 'mumbai', labelKey: 'districts.mumbai' },
  { value: 'pune', labelKey: 'districts.pune' },
  { value: 'nagpur', labelKey: 'districts.nagpur' },
  { value: 'nashik', labelKey: 'districts.nashik' },
  { value: 'thane', labelKey: 'districts.thane' },
  { value: 'aurangabad', labelKey: 'districts.aurangabad' },
  
  // Punjab
  { value: 'ludhiana', labelKey: 'districts.ludhiana' },
  { value: 'amritsar', labelKey: 'districts.amritsar' },
  { value: 'jalandhar', labelKey: 'districts.jalandhar' },
  { value: 'patiala', labelKey: 'districts.patiala' },
  
  // Haryana
  { value: 'gurugram', labelKey: 'districts.gurugram' },
  { value: 'faridabad', labelKey: 'districts.faridabad' },
  { value: 'rohtak', labelKey: 'districts.rohtak' },
  { value: 'hisar', labelKey: 'districts.hisar' },
  
  // Gujarat
  { value: 'ahmedabad', labelKey: 'districts.ahmedabad' },
  { value: 'surat', labelKey: 'districts.surat' },
  { value: 'vadodara', labelKey: 'districts.vadodara' },
  { value: 'rajkot', labelKey: 'districts.rajkot' },
  
  // Karnataka
  { value: 'bangalore', labelKey: 'districts.bangalore' },
  { value: 'mysore', labelKey: 'districts.mysore' },
  { value: 'hubli', labelKey: 'districts.hubli' },
  { value: 'belgaum', labelKey: 'districts.belgaum' },
  
  // Tamil Nadu
  { value: 'chennai', labelKey: 'districts.chennai' },
  { value: 'coimbatore', labelKey: 'districts.coimbatore' },
  { value: 'madurai', labelKey: 'districts.madurai' },
  { value: 'salem', labelKey: 'districts.salem' },
  
  // Rajasthan
  { value: 'jaipur', labelKey: 'districts.jaipur' },
  { value: 'jodhpur', labelKey: 'districts.jodhpur' },
  { value: 'udaipur', labelKey: 'districts.udaipur' },
  { value: 'kota', labelKey: 'districts.kota' },
  
  // Madhya Pradesh
  { value: 'bhopal', labelKey: 'districts.bhopal' },
  { value: 'indore', labelKey: 'districts.indore' },
  { value: 'gwalior', labelKey: 'districts.gwalior' },
  { value: 'jabalpur', labelKey: 'districts.jabalpur' },
];