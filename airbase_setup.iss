; ============================================================================
; Airbase — Windows Installer Script (Inno Setup)
; ============================================================================
; Downloads: https://jrsoftware.org/isdl.php
; Compiles dist/Airbase into Airbase-Setup-v1.0.exe with Desktop & Start Menu shortcuts.

#define MyAppName "Airbase"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Airbase Open Source Project"
#define MyAppURL "https://github.com/SakethGoljana/Airbase"
#define MyAppExeName "Airbase.exe"

[Setup]
AppId={{E8F51A3B-7B5D-4921-9876-AIRBASEHUB01}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DisableProgramGroupPage=yes
OutputDir=installer_output
OutputBaseFilename=Airbase-Setup-v1.0
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
SetupIconFile=static\images\app_icon.ico
PrivilegesRequired=lowest

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "dist\AirbaseApp\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
