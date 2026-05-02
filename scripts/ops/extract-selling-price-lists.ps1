param(
  [Parameter(Mandatory = $true)]
  [string]$InputDir,
  [string]$OutputPath = "tmp/price-lists/selling-price-lists.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InputDir)) {
  throw "Input directory not found: $InputDir"
}

$resolvedOutput = Resolve-Path -LiteralPath "." | ForEach-Object { Join-Path $_ $OutputPath }
$outputDir = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

function Find-HeaderRow {
  param(
    $worksheet,
    [int]$maxRows,
    [int]$maxCols
  )

  for ($r = 1; $r -le $maxRows; $r++) {
    $hasDescription = $false
    $hasPrice = $false
    for ($c = 1; $c -le $maxCols; $c++) {
      $cellText = [string]$worksheet.Cells.Item($r, $c).Text
      if ($cellText -match "Description|DESCRIPTION|Product|Item") { $hasDescription = $true }
      if ($cellText -match "Price|Cost") { $hasPrice = $true }
    }
    if ($hasDescription -and $hasPrice) { return $r }
  }

  return 1
}

function Resolve-Column {
  param(
    [hashtable]$headers,
    [string]$pattern
  )

  $match = $headers.GetEnumerator() |
    Where-Object { $_.Value -match $pattern } |
    Select-Object -First 1

  if ($null -eq $match) { return $null }
  return [int]$match.Key
}

try {
  $files = Get-ChildItem -LiteralPath $InputDir -Filter *.xlsx | Sort-Object Name
  $result = @()

  foreach ($file in $files) {
    $workbook = $excel.Workbooks.Open($file.FullName)
    $worksheet = $workbook.Worksheets.Item(1)
    $usedRange = $worksheet.UsedRange

    $maxRowDetect = [Math]::Min($usedRange.Rows.Count, 40)
    $maxColDetect = [Math]::Min($usedRange.Columns.Count, 10)
    $headerRow = Find-HeaderRow -worksheet $worksheet -maxRows $maxRowDetect -maxCols $maxColDetect

    $headers = @{}
    for ($c = 1; $c -le $usedRange.Columns.Count; $c++) {
      $headerText = [string]$worksheet.Cells.Item($headerRow, $c).Text
      if (-not [string]::IsNullOrWhiteSpace($headerText)) {
        $headers[$c] = $headerText.Trim()
      }
    }

    $barcodeCol = Resolve-Column -headers $headers -pattern "^barcode$|bar.?code"
    $descriptionCol = Resolve-Column -headers $headers -pattern "^description$|product|item"
    $priceCol = Resolve-Column -headers $headers -pattern "cost price per pc|price per pc|unit price|price"

    $rows = @()
    for ($r = $headerRow + 1; $r -le $usedRange.Rows.Count; $r++) {
      $barcode = if ($barcodeCol) { [string]$worksheet.Cells.Item($r, $barcodeCol).Text } else { "" }
      $description = if ($descriptionCol) { [string]$worksheet.Cells.Item($r, $descriptionCol).Text } else { "" }
      $rawPrice = if ($priceCol) { [string]$worksheet.Cells.Item($r, $priceCol).Text } else { "" }

      $barcode = $barcode.Trim()
      $description = $description.Trim()
      $rawPrice = $rawPrice.Trim()

      if ([string]::IsNullOrWhiteSpace($barcode) -and [string]::IsNullOrWhiteSpace($description) -and [string]::IsNullOrWhiteSpace($rawPrice)) {
        continue
      }

      $price = $null
      if (-not [string]::IsNullOrWhiteSpace($rawPrice)) {
        $clean = ($rawPrice -replace ",", "") -replace "[^0-9\.\-]", ""
        $tmp = 0.0
        if ([double]::TryParse($clean, [ref]$tmp)) {
          $price = [Math]::Round($tmp, 3)
        }
      }

      $rows += [pscustomobject]@{
        barcode = $barcode
        description = $description
        price = $price
        rawPrice = $rawPrice
      }
    }

    $result += [pscustomobject]@{
      fileName = $file.Name
      sheetName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
      sourcePath = $file.FullName
      headerRow = $headerRow
      columns = [pscustomobject]@{
        barcode = $barcodeCol
        description = $descriptionCol
        price = $priceCol
      }
      rowCount = $rows.Count
      rows = $rows
    }

    $workbook.Close($false)
  }

  $json = $result | ConvertTo-Json -Depth 10
  [System.IO.File]::WriteAllText($resolvedOutput, $json, [System.Text.UTF8Encoding]::new($false))

  Write-Output "Extracted $($result.Count) workbook(s)"
  Write-Output "Output: $resolvedOutput"
}
finally {
  if ($excel) {
    $excel.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
  }
}
