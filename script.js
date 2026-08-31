const dialog = document.querySelector("#project-dialog");
const projectFrame = dialog?.querySelector(".project-frame");
const dialogTitle = dialog?.querySelector("#dialog-title");
const openPdfLink = dialog?.querySelector(".open-pdf");
const closeDialogButton = dialog?.querySelector(".dialog-close");
const loadingLabel = dialog?.querySelector(".dialog-loading");
const projectButtons = document.querySelectorAll("[data-project-pdf]");

function openProject(button) {
  if (!dialog || !projectFrame || !dialogTitle || !openPdfLink) return;
  const pdfPath = button.dataset.projectPdf;
  const title = button.dataset.projectTitle;
  if (!pdfPath || !title) return;

  dialogTitle.textContent = title;
  openPdfLink.href = pdfPath;
  loadingLabel?.removeAttribute("hidden");
  dialog.showModal();
  document.body.classList.add("dialog-open");

  // The large PDF is loaded only after the user chooses a project.
  requestAnimationFrame(() => {
    projectFrame.src = `${pdfPath}#view=FitH`;
  });
}

function closeProject() {
  if (!dialog || !projectFrame) return;
  dialog.close();
  projectFrame.removeAttribute("src");
  loadingLabel?.removeAttribute("hidden");
  document.body.classList.remove("dialog-open");
}

projectButtons.forEach((button) => button.addEventListener("click", () => openProject(button)));
closeDialogButton?.addEventListener("click", closeProject);
projectFrame?.addEventListener("load", () => loadingLabel?.setAttribute("hidden", ""));
dialog?.addEventListener("click", (event) => { if (event.target === dialog) closeProject(); });
dialog?.addEventListener("cancel", (event) => { event.preventDefault(); closeProject(); });

const primaryNavLinks = [...document.querySelectorAll(".section-nav-top a[href^='#']")];
const observedSections = primaryNavLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

function setActiveNav(sectionId) {
  primaryNavLinks.forEach((link) => {
    const isCurrent = link.getAttribute("href") === `#${sectionId}`;
    link.classList.toggle("is-active", isCurrent);
    if (isCurrent) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

if (primaryNavLinks.length && observedSections.length) {
  let navFrame = 0;
  const syncActiveNav = () => {
    navFrame = 0;
    const marker = window.scrollY + 80;
    const reachedPageEnd = Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 2;
    const currentSection = reachedPageEnd
      ? observedSections[observedSections.length - 1]
      : observedSections.reduce((current, section) => (
        section.offsetTop <= marker ? section : current
      ), observedSections[0]);
    setActiveNav(currentSection.id);
  };

  primaryNavLinks.forEach((link) => link.addEventListener("click", () => {
    setActiveNav(link.getAttribute("href").slice(1));
  }));
  window.addEventListener("scroll", () => {
    if (!navFrame) navFrame = requestAnimationFrame(syncActiveNav);
  }, { passive: true });
  syncActiveNav();
}

const experienceJumpLinks = [...document.querySelectorAll(".experience-jump-nav a[href^='#']")];
const experienceSections = experienceJumpLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

function setActiveExperienceJump(sectionId) {
  experienceJumpLinks.forEach((link) => {
    const isCurrent = link.getAttribute("href") === `#${sectionId}`;
    link.classList.toggle("is-active", isCurrent);
    if (isCurrent) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

if (experienceJumpLinks.length && experienceSections.length) {
  let experienceFrame = 0;
  const syncExperienceJump = () => {
    experienceFrame = 0;
    const stickyOffset = window.matchMedia("(max-width: 720px)").matches ? 112 : 68;
    const marker = window.scrollY + stickyOffset;
    const currentSection = experienceSections.reduce((current, section) => {
      const sectionTop = section.getBoundingClientRect().top + window.scrollY;
      return sectionTop <= marker ? section : current;
    }, experienceSections[0]);
    setActiveExperienceJump(currentSection.id);
  };

  experienceJumpLinks.forEach((link) => link.addEventListener("click", () => {
    setActiveExperienceJump(link.getAttribute("href").slice(1));
  }));
  window.addEventListener("scroll", () => {
    if (!experienceFrame) experienceFrame = requestAnimationFrame(syncExperienceJump);
  }, { passive: true });
  window.addEventListener("resize", syncExperienceJump, { passive: true });
  syncExperienceJump();
}
