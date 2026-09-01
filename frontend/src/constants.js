export const CATEGORIES = ['Art', 'Music', 'Dance', 'Sports', 'Cooking', 'Tech', 'Comedy', 'Education', 'Fashion', 'Gaming'];

export const ELIGIBLE_RESIDENCY = 'Chhattisgarh';

// Mirrors the User Service's allow-list so a typo can never silently cost someone
// contest eligibility (a free-text field previously let "Chattisghar" slip through).
export const RESIDENCY_OPTIONS = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
    'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry',
    'Chandigarh', 'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli and Daman and Diu',
    'Lakshadweep', 'Other'
];

export const WINNER_TIERS = ['GRAND_PRIZE', 'CONSISTENCY_1', 'CONSISTENCY_2', 'TOP_PERFORMER', 'CATEGORY_1', 'CATEGORY_2'];
