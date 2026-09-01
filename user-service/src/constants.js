const CATEGORIES = ['Art', 'Music', 'Dance', 'Sports', 'Cooking', 'Tech', 'Comedy', 'Education', 'Fashion', 'Gaming'];

// Fixed allow-list so residency can't be typo'd ("Chattisghar", "CG", etc.) into
// silently losing contest eligibility. "Chhattisgarh" is the only eligible value.
const RESIDENCY_OPTIONS = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
    'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry',
    'Chandigarh', 'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli and Daman and Diu',
    'Lakshadweep', 'Other'
];

const ELIGIBLE_RESIDENCY = 'Chhattisgarh';

const INTERACTION_TYPES = ['like', 'comment', 'view'];

module.exports = { CATEGORIES, RESIDENCY_OPTIONS, ELIGIBLE_RESIDENCY, INTERACTION_TYPES };
