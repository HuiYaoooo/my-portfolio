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
