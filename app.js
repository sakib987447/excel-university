/* Shared markup helpers: content that used to be copy-pasted in index.html is
   described as data here and rendered from a single template. */

const renderInto = (containerId, items, renderItem) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = items.map(renderItem).join("");
};

const featureCard = ({ icon, title, text }) => `
    <div class="col-md-6 mb-4">
        <div class="text-center">
            <div class="about-icon">
                <i class="fa-solid ${icon}"></i>
            </div>
            <h5>${title}</h5>
            <p>${text}</p>
        </div>
    </div>`;

const courseCard = ({ icon, title, text, levels }) => `
    <div class="col-md-6 col-lg-3">
        <div class="courses-card card surface h-100">

            <div class="card-header text-center">
                <div class="courses-icon">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <h4 class="card-title">${title}</h4>
            </div>

            <div class="card-body">
                <p class="card-text">${text}</p>
                <ul class="list-unstyled">
                    ${levels.map((level) => `<li><i class="fa-solid fa-check text-success me-2"></i>${level}</li>`).join("")}
                </ul>
            </div>

        </div>
    </div>`;

const footerLink = ({ href, label }) => `<a href="${href}">${label}</a>`;

const socialLink = ({ href, icon }) => `<a href="${href}" class="text-white me-3"><i class="fa-brands ${icon}"></i></a>`;

const FEATURE_TEXT = "Lorem ipsum dolor, sit amet consectetur adipisicing elit. Minus, molestias!";

const FEATURES = [
    { icon: "fa-graduation-cap", title: "Quality Education", text: FEATURE_TEXT },
    { icon: "fa-user", title: "Expert Faculty", text: FEATURE_TEXT }
];

const COURSE_TEXT = "Lorem ipsum dolor sit amet consectetur adipisicing elit. Perferendis earum maiores commodi fugiat, sit recusandae?";
const COURSE_LEVELS = ["4-year Bachelor's", "2-year Master's", "Phn Program's"];

const COURSES = ["Copmuter Science", "Buisness Science", "Engineering Science", "Health Science"].map((title) => ({
    icon: "fa-laptop",
    title,
    text: COURSE_TEXT,
    levels: COURSE_LEVELS
}));

const QUICK_LINKS = ["Home", "About", "Courses", "Acedmic Program", "Research"].map((label) => ({
    href: "#",
    label
}));

const SOCIAL_LINKS = ["fa-instagram", "fa-facebook", "fa-whatsapp", "fa-x-twitter"].map((icon) => ({
    href: "#",
    icon
}));

renderInto("about-features", FEATURES, featureCard);
renderInto("courses-grid", COURSES, courseCard);
renderInto("footer-quick-links", QUICK_LINKS, footerLink);
renderInto("footer-social-links", SOCIAL_LINKS, socialLink);
